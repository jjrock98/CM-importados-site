// Tipos, valores iniciales y funciones puras de la calculadora de costos.
// Se movieron tal cual desde CalculadoraCostos.tsx (sin cambios de lógica).
import type { Moneda, Veredicto } from '@/lib/rentabilidad';
import type { ConfigLonas } from '@/lib/lonas';

export interface ProductoCatalogo {
  product_id: string;
  nombre: string;
  precio_docena_actual: number;
}

export interface CatalogoResponse {
  total_gastos_fijos_mensuales: number;
  docenas_estimadas: number;
  rows: ProductoCatalogo[];
}

export interface Dolar {
  compra: number | null;
  venta: number;
  fecha: string | null;
}

export interface LineaForm {
  id: number;
  concepto: string;
  monto: string;
  moneda: Moneda;
  fija: boolean; // las 4 líneas base no se pueden quitar
}

export type Modo = 'simple' | 'multi';

export interface ConfigForm {
  docenasTotales: string; // total de docenas de la compra, declarado antes de detallar los modelos
  docenasPorLona: string;
  costoLona: string;
  monedaLona: Moneda;
  redondearLonas: boolean;
  costoEnvioLona: string;
  monedaEnvio: Moneda;
  redondearEnvio: boolean;
  aplicarRecargo: boolean; // compra a distancia: recargo % sobre la mercadería
  recargoPct: string;
  recargoFijo: string;
  monedaRecargoFijo: Moneda;
}

export interface ModeloForm {
  id: number;
  productId: string;
  modelo: string;
  docenas: string;
  precioDocena: string;
  moneda: Moneda;
  precioVenta: string;
}

export const CONFIG_INICIAL: ConfigForm = {
  docenasTotales: '',
  docenasPorLona: '24',
  costoLona: '',
  monedaLona: 'ARS',
  redondearLonas: false,
  costoEnvioLona: '',
  monedaEnvio: 'ARS',
  redondearEnvio: true,
  aplicarRecargo: false,
  recargoPct: '',
  recargoFijo: '',
  monedaRecargoFijo: 'ARS',
};

export const MODELO_VACIO = (id: number): ModeloForm => ({
  id, productId: '', modelo: '', docenas: '', precioDocena: '', moneda: 'ARS', precioVenta: '',
});

export const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);
export const num2 = (n: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
export const pct = (n: number) => `${num2(n)} %`;
export const toNum = (v: string) => {
  const n = Number(v);
  return v.trim() === '' || Number.isNaN(n) ? 0 : n;
};

export const LINEAS_INICIALES: LineaForm[] = [
  { id: 1, concepto: 'Mercadería / lona', monto: '', moneda: 'ARS', fija: true },
  { id: 2, concepto: 'Transporte', monto: '', moneda: 'ARS', fija: true },
  { id: 3, concepto: 'Envío', monto: '', moneda: 'ARS', fija: true },
  { id: 4, concepto: 'Otros costos directos', monto: '', moneda: 'ARS', fija: true },
];

export const VEREDICTOS: Record<Veredicto, { titulo: string; clase: string }> = {
  optimo: {
    titulo: 'Precio rentable: alcanza el margen objetivo',
    clase: 'border-green-300 bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-300',
  },
  bajo_objetivo: {
    titulo: 'Da ganancia, pero por debajo del margen objetivo',
    clase: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300',
  },
  perdida: {
    titulo: 'No es rentable: con este precio se pierde plata',
    clase: 'border-red-300 bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-300',
  },
};