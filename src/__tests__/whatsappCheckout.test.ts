import { buildWhatsAppMessage } from '@/app/checkout/checkoutHelpers';
import type { CartItem } from '@/types';

const form = {
  nombre: 'Ana Pérez', email: 'ana@mail.com', telefono: '1122334455',
  direccion: 'Calle 123', ciudad: 'Lomas de Zamora', codigo_postal: '1832', notas: '',
  micro_empresa_transporte: '', micro_nombre_recibe: '',
};
const items: CartItem[] = [
  { productId: 'p1', productSlug: 'remera', nombre: 'Remera básica', imagen: '', tipoPack: 'docena',
    cantidadPacks: 2, unidades: 24, precioUnitario: 5000, subtotal: 120000, variantLabel: 'Talla M / Azul' },
  { productId: 'p2', productSlug: 'jean', nombre: 'Jean', imagen: '', tipoPack: 'unidad',
    cantidadPacks: 3, unidades: 3, precioUnitario: 15000, subtotal: 45000 },
];
const base = { items, form, tipoEntrega: 'envio' as const, microTerminal: null, subtotal: 165000, total: 165000 };
const arg = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

describe('buildWhatsAppMessage', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-04T15:30:00Z')); // 12:30 en Buenos Aires
    process.env.NEXT_PUBLIC_TIENDA_NOMBRE = 'Mi Tienda de Prueba';
  });
  afterAll(() => { jest.useRealTimers(); delete process.env.NEXT_PUBLIC_TIENDA_NOMBRE; });

  it('arma el saludo, la fecha en hora argentina, los datos del cliente y los productos', () => {
    const m = buildWhatsAppMessage(base);
    expect(m).toContain('¡Hola Mi Tienda de Prueba! 👋');
    expect(m).toContain('4 de noviembre de 2026');
    expect(m).toContain('12:30');
    expect(m).toContain('Nombre: Ana Pérez');
    expect(m).toContain('Email: ana@mail.com');
    expect(m).toContain('Teléfono: 1122334455');
    expect(m).toContain(`• Remera básica (Talla M / Azul) — Docena (12 uds) × 2 = ${arg(120000)}`);
    expect(m).toContain(`• Jean — Unidad × 3 = ${arg(45000)}`);
    expect(m).toContain(`*TOTAL: ${arg(165000)}*`);
    expect(m.trim().endsWith('¿Podés confirmarme disponibilidad? 🙏')).toBe(true);
  });

  it('envío a domicilio: muestra la dirección y deja el costo a coordinar', () => {
    const m = buildWhatsAppMessage(base);
    expect(m).toContain('🚚 *Envío a domicilio*');
    expect(m).toContain('Calle 123, Lomas de Zamora (CP 1832)');
    expect(m).toContain('Envío: a coordinar');
  });

  it('retiro en local', () => {
    const m = buildWhatsAppMessage({ ...base, tipoEntrega: 'retiro' });
    expect(m).toContain('🏪 *Retiro en local*');
    expect(m).toContain('Envío: Retiro en local');
    expect(m).not.toContain('Calle 123');
  });

  it('micro: terminal, empresa y quién recibe (con "—" si faltan datos)', () => {
    const completo = buildWhatsAppMessage({
      ...base, tipoEntrega: 'micro', microTerminal: 'ocean',
      form: { ...form, micro_empresa_transporte: 'Expreso Sur', micro_nombre_recibe: 'Juan' },
    });
    expect(completo).toContain('🚌 *Entrega en micro — La Salada*');
    expect(completo).toContain('Terminal: Ocean');
    expect(completo).toContain('Micro/empresa: Expreso Sur');
    expect(completo).toContain('Recibe: Juan');
    expect(completo).toContain('Envío: Entrega en micro (gratis)');

    const vacio = buildWhatsAppMessage({ ...base, tipoEntrega: 'micro', microTerminal: null });
    expect(vacio).toContain('Terminal: —');
    expect(vacio).toContain('Micro/empresa: —');
    expect(vacio).toContain('Recibe: —');
  });

  it('notas del cliente solo si las hay, y sin líneas vacías consecutivas', () => {
    expect(buildWhatsAppMessage(base)).not.toContain('Notas');
    const m = buildWhatsAppMessage({ ...base, form: { ...form, notas: 'Tocar timbre 2B' } });
    expect(m).toContain('📝 *Notas:* Tocar timbre 2B');
    expect(m).not.toMatch(/\n\n\n/);
  });

  it('teléfono vacío se muestra como "—"', () => {
    expect(buildWhatsAppMessage({ ...base, form: { ...form, telefono: '' } })).toContain('Teléfono: —');
  });
});