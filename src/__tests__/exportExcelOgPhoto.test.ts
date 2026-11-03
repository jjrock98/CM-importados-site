/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import sharp from 'sharp';

// ── Mocks ──────────────────────────────────────────────────────────────
const mockVerifyAdmin = jest.fn();
jest.mock('@/lib/auth/verifyAdmin', () => ({ verifyAdmin: () => mockVerifyAdmin() }));

const mockTables: Record<string, { data: unknown; error?: unknown }> = {};
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const result = mockTables[table] ?? { data: [] };
      // Builder "awaitable": soporta .select().eq().order() y .maybeSingle()
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.order = () => q;
      q.maybeSingle = () => Promise.resolve(result);
      q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve(result).then(res, rej);
      return q;
    },
  }),
}));

const mockOgLimiter = jest.fn();
jest.mock('@/lib/rateLimit', () => ({
  rateLimiters: { ogPhoto: (req: NextRequest) => mockOgLimiter(req) },
}));

import { GET as exportCostosExcel } from '@/app/api/admin/costos/export/excel/route';
import { POST as exportMultimodelo } from '@/app/api/admin/costos/export/multimodelo/route';
import { GET as ogPhoto } from '@/app/api/og-photo/route';

async function leerXlsx(res: Response): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()) as unknown as ArrayBuffer);
  return wb;
}

// ── Exportación a Excel: costos por docena ─────────────────────────────
describe('GET /api/admin/costos/export/excel', () => {
  beforeEach(() => {
    mockVerifyAdmin.mockResolvedValue({ id: 'admin-1' });
    mockTables.products = { data: [{ id: 'p1', nombre: 'Remera básica', precio_docena: 90000 }] };
    mockTables.product_costs = {
      data: [{ product_id: 'p1', costo_compra_docena: 50000, transporte_docena: 5000, empaque_docena: 2000, otros_docena: 0 }],
    };
    mockTables.cost_settings = { data: [] };
    mockTables.cost_period_config = { data: null };
  });

  it('rechaza si no es admin', async () => {
    mockVerifyAdmin.mockResolvedValue(null);
    const res = await exportCostosExcel(new NextRequest('http://localhost/api/admin/costos/export/excel'));
    expect(res.status).toBe(403);
  });

  it('genera un .xlsx válido con fórmulas vivas y valores de respaldo', async () => {
    const res = await exportCostosExcel(
      new NextRequest('http://localhost/api/admin/costos/export/excel?periodo=2026-11&margenes=30,50'),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(res.headers.get('content-disposition')).toContain('costos-por-docena-2026-11.xlsx');

    const wb = await leerXlsx(res);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Costos por Docena', 'Parámetros']);

    const ws = wb.getWorksheet('Costos por Docena')!;
    const header = ws.getRow(1).values as (string | undefined)[];
    expect(header.slice(1, 8)).toEqual([
      'Producto', 'Compra/Doc', 'Transporte/Doc', 'Empaque/Doc',
      'Fijos prorrateados/Doc', 'Costo Total/Doc', 'Precio actual catálogo',
    ]);
    expect(header[8]).toBe('Sugerido 30%');
    expect(header[9]).toBe('Recomendado 30%');
    expect(header[10]).toBe('Sugerido 50%');

    const fila = ws.getRow(2);
    expect(fila.getCell(1).value).toBe('Remera básica');
    const costoTotal = Number(fila.getCell(6).value);
    expect(costoTotal).toBeGreaterThan(0);

    // Sugerido 30%: fórmula sobre la columna F + resultado en caché
    const sug30 = fila.getCell(8).value as ExcelJS.CellFormulaValue;
    expect(sug30.formula).toBe('F2*(1+30/100)');
    expect(sug30.result).toBeCloseTo(Math.round(costoTotal * 1.3 * 100) / 100, 2);
    // Recomendado 30%: CEILING del sugerido
    const rec30 = fila.getCell(9).value as ExcelJS.CellFormulaValue;
    expect(rec30.formula).toBe('CEILING(H2,1)');
    expect(rec30.result).toBe(Math.ceil(sug30.result as number));
    // Segundo margen arranca dos columnas más adelante
    expect((fila.getCell(10).value as ExcelJS.CellFormulaValue).formula).toBe('F2*(1+50/100)');
    expect((fila.getCell(11).value as ExcelJS.CellFormulaValue).formula).toBe('CEILING(J2,1)');
  });
});

// ── Exportación a Excel: compra multimodelo ────────────────────────────
describe('POST /api/admin/costos/export/multimodelo?format=excel', () => {
  const modelo = {
    modelo: 'Jean clásico', docenas: 4, precioDocenaArs: 100000, mercaderiaArs: 400000,
    lonasArs: 10000, envioArs: 20000, recargosArs: 0, directoTotalArs: 430000,
    directoDocena: 107500, imprevistosArs: 0, precioVenta: 150000,
    costoRealDocena: 107500, gananciaDocena: 42500, margenPct: 28.3, markupPct: 39.5,
    precioRecomendado: 160000, veredicto: 'optimo',
  };
  const body = {
    nombre: 'Compra de prueba', fecha: '2026-11-02T12:00:00.000Z',
    docenasTotales: 4, docenasDeclaradas: null, lonasUsadas: 1, lonasCobradas: 1, bultosEnvio: 1,
    lonaUnitariaArs: 10000, envioUnitarioArs: 20000, costoLonasArs: 10000, costoEnvioArs: 20000,
    mercaderiaTotalArs: 400000, recargoPctArs: 0, mercaderiaConRecargoArs: 400000, recargoFijoArs: 0,
    costoDirectoTotalArs: 430000, imprevistosArs: 0,
    modelos: [modelo, { ...modelo, modelo: 'Sin datos', costoRealDocena: null, gananciaDocena: null, margenPct: null, markupPct: null, precioRecomendado: null, veredicto: null }],
  };
  const llamar = (b: unknown) =>
    exportMultimodelo(new NextRequest('http://localhost/api/admin/costos/export/multimodelo?format=excel', {
      method: 'POST', body: JSON.stringify(b),
    }));

  beforeEach(() => mockVerifyAdmin.mockResolvedValue({ id: 'admin-1' }));

  it('genera las dos hojas con los datos de cada modelo', async () => {
    const res = await llamar(body);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('compra-de-prueba.xlsx');

    const wb = await leerXlsx(res);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Detalle por modelo', 'Resumen de la compra']);

    const det = wb.getWorksheet('Detalle por modelo')!;
    expect(det.getRow(1).getCell(1).value).toBe('Modelo');
    expect(det.getRow(2).getCell(1).value).toBe('Jean clásico');
    expect(det.getRow(2).getCell(17).value).toBe('Rentable');
    // Un modelo sin datos deja celdas vacías (no "0" ni texto)
    expect(det.getRow(3).getCell(12).value).toBeNull();
    expect(det.getRow(3).getCell(17).value).toBe('—');

    const res2 = wb.getWorksheet('Resumen de la compra')!;
    expect(res2.getRow(1).getCell(2).value).toBe('Compra de prueba');
    const etiquetas = res2.getColumn(1).values as (string | undefined)[];
    expect(etiquetas).toContain('Costo directo total de la compra');
  });

  it('rechaza datos inválidos y usuarios no admin', async () => {
    expect((await llamar({ ...body, modelos: [] })).status).toBe(400);
    mockVerifyAdmin.mockResolvedValue(null);
    expect((await llamar(body)).status).toBe(403);
  });
});

// ── /api/og-photo: rate limit ──────────────────────────────────────────
describe('GET /api/og-photo', () => {
  const OLD_ENV = process.env;
  const fetchOriginal = global.fetch;
  const urlValida = 'https://abc.supabase.co/storage/v1/object/public/products/foto.png';
  const req = (src: string) =>
    new NextRequest(`http://localhost/api/og-photo?src=${encodeURIComponent(src)}`);

  beforeEach(() => {
    process.env = { ...OLD_ENV, NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' };
    mockOgLimiter.mockReset();
  });
  afterEach(() => { process.env = OLD_ENV; global.fetch = fetchOriginal; });

  it('un origen inválido da 400 sin gastar cupo del límite', async () => {
    const res = await ogPhoto(req('https://evil.example.com/storage/v1/object/public/x.png'));
    expect(res.status).toBe(400);
    expect(mockOgLimiter).not.toHaveBeenCalled();
  });

  it('si se excede el límite responde 429 y NO descarga ni procesa la imagen', async () => {
    mockOgLimiter.mockResolvedValue(NextResponse.json({ error: 'x' }, { status: 429 }));
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await ogPhoto(req(urlValida));
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dentro del límite sigue devolviendo un JPEG cacheable', async () => {
    mockOgLimiter.mockResolvedValue(null);
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#cc3366' } }).png().toBuffer();
    global.fetch = jest.fn().mockResolvedValue(new Response(new Uint8Array(png), { status: 200 })) as unknown as typeof fetch;
    const res = await ogPhoto(req(urlValida));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toContain('s-maxage=31536000');
  });
});