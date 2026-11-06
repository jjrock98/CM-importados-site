// Subcomponentes de presentación de la calculadora de costos.
// Se movieron tal cual desde CalculadoraCostos.tsx (sin cambios de lógica).
import { cn } from '@/utils';
import { AVISO_SIN_DOCENAS_ESTIMADAS, type Moneda, type ResultadoRentabilidad } from '@/lib/rentabilidad';
import { ars, num2, pct, VEREDICTOS } from './calculadoraCostos.shared';

export function Fila({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn('min-w-0 wrap-break-word', !fuerte && 'text-muted')}>{k}</span>
      <span className={cn('shrink-0 text-right', fuerte && 'font-semibold')}>{v}</span>
    </div>
  );
}

export function CampoMonto({
  label, valor, moneda, onValor, onMoneda,
}: {
  label: string;
  valor: string;
  moneda: Moneda;
  onValor: (v: string) => void;
  onMoneda: (m: Moneda) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted">{label}</label>
      <div className="flex gap-2">
        <input type="number" step="any" min={0} value={valor} onChange={(e) => onValor(e.target.value)} className="input-base w-full py-1.5" placeholder="0" />
        <select value={moneda} onChange={(e) => onMoneda(e.target.value as Moneda)} className="input-base w-auto py-1.5">
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </div>
    </div>
  );
}

/** Gastos → costo real → ganancia/margen/markup → ¿está bien el precio? (por modelo, en compras multimodelo). */
export function IndicadoresPrecio({
  res, precio, comisionPct, fijosMensuales, docenasMes, margenObjetivo,
}: {
  res: ResultadoRentabilidad;
  precio: number;
  comisionPct: number;
  fijosMensuales: number;
  docenasMes: number;
  margenObjetivo: number;
}) {
  return (
    <>
      <p className="pt-2 text-xs font-medium uppercase text-muted">Gastos</p>
      <Fila k={`Comisiones (${num2(comisionPct)} % del precio)`} v={ars(res.comisionDocena)} />
      <Fila k="Otros gastos variables" v={ars(res.variableFijoDocena)} />
      <Fila k={`Gastos fijos asignados (${ars(fijosMensuales)} ÷ ${num2(docenasMes)} docenas)`} v={ars(res.fijoDocena)} />
      <Fila k="Imprevistos (parte del lote)" v={ars(res.imprevistosDocena)} />
      <div className="my-1 border-t border-border" />
      <Fila k="Costo real por docena" v={ars(res.costoRealDocena)} fuerte />
      <Fila k="Precio de venta pretendido" v={ars(precio)} />
      <Fila k="Ganancia por docena" v={ars(res.gananciaDocena)} fuerte />
      <Fila k="Margen (ganancia ÷ precio)" v={pct(res.margenPct)} />
      <Fila k="Markup (ganancia ÷ costo)" v={pct(res.markupPct)} />

      <div className={cn('mt-2 rounded-lg border p-2 text-xs font-medium', VEREDICTOS[res.veredicto].clase)}>
        {VEREDICTOS[res.veredicto].titulo}
      </div>
      <Fila k="Precio mínimo para no perder" v={res.precioMinimo === null ? '—' : ars(res.precioMinimo)} />
      <Fila k={`Precio para margen objetivo (${num2(margenObjetivo)} %)`} v={res.precioObjetivo === null ? '—' : ars(res.precioObjetivo)} />
      <Fila k="Precio recomendado (redondeado hacia arriba)" v={res.precioRecomendado === null ? '—' : ars(res.precioRecomendado)} fuerte />
      <p className="pt-1">
        {res.puntoEquilibrioDocenas === null
          ? 'Con este precio no se cubren los gastos fijos: no hay punto de equilibrio.'
          : res.puntoEquilibrioDocenas === 0
            ? 'No hay gastos fijos cargados: no hay punto de equilibrio que calcular.'
            : `Necesitás vender aproximadamente ${num2(res.puntoEquilibrioDocenas)} docenas por mes de este modelo para cubrir los gastos fijos.`}
      </p>
      {res.avisos
        // El aviso de "sin docenas estimadas" es un dato común a toda la
        // compra (no de este modelo en particular): se muestra una sola
        // vez en el desglose general para no repetirlo en cada tarjeta.
        .filter((a) => a !== AVISO_SIN_DOCENAS_ESTIMADAS)
        .map((a, i) => (
          <p key={i} className="text-xs text-amber-700 dark:text-amber-400">⚠ {a}</p>
        ))}
    </>
  );
}