/**
 * @jest-environment jsdom
 *
 * Sentry en el navegador: no se descarga al abrir la página, solo ante el
 * primer error (así no suma al JS inicial ni al hilo principal en PageSpeed).
 */
const mockInit = jest.fn();
const mockCapture = jest.fn();

function cargarModulos(opciones: { dsn?: string }) {
  jest.resetModules();
  jest.doMock('@sentry/nextjs', () => ({ init: mockInit, captureException: mockCapture }));
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = 'production';
  if (opciones.dsn) env.NEXT_PUBLIC_SENTRY_DSN = opciones.dsn;
  else delete env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    cliente: require('@/lib/sentryClient') as typeof import('@/lib/sentryClient'),
  };
}
const esperar = () => new Promise((r) => setTimeout(r, 0));
const DSN = 'https://publica@o1.ingest.sentry.io/1';

beforeEach(() => { mockInit.mockReset(); mockCapture.mockReset(); });
afterEach(() => { jest.restoreAllMocks(); (process.env as Record<string, string | undefined>).NODE_ENV = 'test'; });

describe('sentryClient', () => {
  it('sin DSN no carga ni inicializa nada', async () => {
    const { cliente } = cargarModulos({});
    await expect(cliente.cargarSentry()).resolves.toBeNull();
    cliente.reportarErrorCliente(new Error('x'));
    await esperar();
    expect(mockInit).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('con DSN inicializa UNA sola vez, aunque se reporten varios errores', async () => {
    const { cliente } = cargarModulos({ dsn: DSN });
    const a = new Error('a'); const b = new Error('b');
    cliente.reportarErrorCliente(a);
    cliente.reportarErrorCliente(b);
    await esperar(); await esperar();
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit.mock.calls[0][0]).toMatchObject({ dsn: DSN, sendDefaultPii: false });
    expect(mockCapture.mock.calls.map((c) => c[0])).toEqual([a, b]);
  });
});

describe('instrumentation-client (carga diferida de Sentry)', () => {
  function arrancar(dsn?: string) {
    const registrados: Record<string, (e: unknown) => void> = {};
    jest.spyOn(window, 'addEventListener').mockImplementation(((t: string, h: (e: unknown) => void) => { registrados[t] = h; }) as never);
    const quitar = jest.spyOn(window, 'removeEventListener').mockImplementation((() => {}) as never);
    cargarModulos({ dsn });
    require('@/instrumentation-client');
    return { registrados, quitar };
  }

  it('al abrir la página solo escucha errores: NO descarga el SDK', async () => {
    const { registrados } = arrancar(DSN);
    expect(Object.keys(registrados).sort()).toEqual(['error', 'unhandledrejection']);
    await esperar();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('sin DSN no registra nada', () => {
    const { registrados } = arrancar(undefined);
    expect(registrados).toEqual({});
  });

  it('el primer error carga el SDK, lo reporta y deja de escuchar', async () => {
    const { registrados, quitar } = arrancar(DSN);
    const err = new Error('falló algo');
    registrados.error(new ErrorEvent('error', { error: err, message: 'falló algo' }));
    await esperar(); await esperar();
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(err);
    expect(quitar).toHaveBeenCalledWith('error', expect.any(Function));
    expect(quitar).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });

  it('una promesa rechazada también dispara la carga', async () => {
    const { registrados } = arrancar(DSN);
    const motivo = new Error('rechazada');
    registrados.unhandledrejection(Object.assign(new Event('unhandledrejection'), { reason: motivo }));
    await esperar(); await esperar();
    expect(mockCapture).toHaveBeenCalledWith(motivo);
  });

  it('un error sin objeto (p. ej. "Script error.") se reporta con su mensaje', async () => {
    const { registrados } = arrancar(DSN);
    registrados.error(new ErrorEvent('error', { message: 'Script error.' }));
    await esperar(); await esperar();
    expect(mockCapture).toHaveBeenCalledWith('Script error.');
  });
});