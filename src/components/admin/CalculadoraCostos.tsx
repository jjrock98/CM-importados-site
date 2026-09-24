'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Save, X } from 'lucide-react';
import { cn } from '@/utils';
import {
  calcularRentabilidad,
  type EntradaRentabilidad,
  type LineaCosto,
  type Moneda,
  type Veredicto,
} from '@/lib/rentabilidad';
import { HistorialSimulaciones, type SimulacionGuardada } from './HistorialSimulaciones';

interface ProductoCatalogo {
  product_id: string;
  nombre: string;
  precio_docena_actual: number;
}

interface CatalogoResponse {
  total_gastos_fijos_mensuales: number;
  docenas_estimadas: number;
  rows: ProductoCatalogo[];
}

interface Dolar {
  compra: number | null;
  venta: number;
  fecha: string | null;
}

interface LineaForm {
  id: number;
  concepto: string;
  monto: string;
  moneda: Moneda;
  fija: boolean; // las 4 líneas base no se pueden quitar
}

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);
const num2 = (n: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const pct = (n: number) => `${num2(n)} %`;
const toNum = (v: string) => {
  const n = Number(v);
  return v.trim() === '' || Number.isNaN(n) ? 0 : n;
};

const LINEAS_INICIALES: LineaForm[] = [
  { id: 1, concepto: 'Mercadería / lona', monto: '', moneda: 'ARS', fija: true },
  { id: 2, concepto: 'Transporte', monto: '', moneda: 'ARS', fija: true },
  { id: 3, concepto: 'Envío', monto: '', moneda: 'ARS', fija: true },
  { id: 4, concepto: 'Otros costos directos', monto: '', moneda: 'ARS', fija: true },
];

const VEREDICTOS: Record<Veredicto, { titulo: string; clase: string }> = {
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

/**
 * Calculadora interna de costos y rentabilidad por docena.
 * Solo lee del catálogo el NOMBRE y el PRECIO de venta por docena, y los
 * gastos fijos ya cargados en el módulo de costos. Nunca modifica el
 * catálogo: lo único que escribe es el historial de simulaciones
 * (tabla cost_simulations), y solo cuando se aprieta "Guardar".
 */
export function CalculadoraCostos() {
  const [catalogo, setCatalogo] = useState<ProductoCatalogo[]>([]);
  const [productoId, setProductoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');

  const [lineas, setLineas] = useState<LineaForm[]>(LINEAS_INICIALES);
  const [docenas, setDocenas] = useState('');

  const [dolar, setDolar] = useState<Dolar | null>(null);
  const [dolarError, setDolarError] = useState<string | null>(null);
  const [dolarLoading, setDolarLoading] = useState(false);
  const [usarManual, setUsarManual] = useState(false);
  const [dolarManual, setDolarManual] = useState('');

  const [comisionPct, setComisionPct] = useState('');
  const [variableDocena, setVariableDocena] = useState('');
  const [fijosMensuales, setFijosMensuales] = useState('');
  const [docenasMes, setDocenasMes] = useState('');
  const [margenObjetivo, setMargenObjetivo] = useState('30');

  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [historialVersion, setHistorialVersion] = useState(0);

  // Catálogo (nombre + precio) y gastos fijos ya cargados en el módulo.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/costos');
        const json: CatalogoResponse = await res.json();
        if (!res.ok || cancelado) return;
        setCatalogo(
          json.rows.map((r) => ({
            product_id: r.product_id,
            nombre: r.nombre,
            precio_docena_actual: r.precio_docena_actual,
          }))
        );
        setFijosMensuales(String(json.total_gastos_fijos_mensuales ?? 0));
        setDocenasMes(String(json.docenas_estimadas ?? 0));
      } catch {
        /* el catálogo es opcional: se puede cargar un producto a mano */
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const cargarDolar = useCallback(async () => {
    setDolarLoading(true);
    setDolarError(null);
    try {
      const res = await fetch('/api/admin/costos/dolar');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al consultar el dólar');
      setDolar(json as Dolar);
    } catch (e) {
      setDolar(null);
      setDolarError(e instanceof Error ? e.message : 'Error al consultar el dólar');
      setUsarManual(true); // sin API, se pasa a cotización manual (y se indica)
    } finally {
      setDolarLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargarDolar(); }, [cargarDolar]);

  const elegirProducto = (id: string) => {
    setProductoId(id);
    const p = catalogo.find((c) => c.product_id === id);
    if (p) {
      setNombre(p.nombre);
      setPrecio(String(p.precio_docena_actual));
    } else {
      setNombre('');
      setPrecio('');
    }
  };

  const cotizacion = usarManual ? toNum(dolarManual) : dolar?.venta ?? 0;
  const origenCotizacion = usarManual ? 'manual' : 'blue';

  const actualizarLinea = (id: number, patch: Partial<LineaForm>) =>
    setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const agregarLinea = () =>
    setLineas((ls) => [...ls, { id: Date.now(), concepto: 'Otro costo', monto: '', moneda: 'ARS', fija: false }]);
  const quitarLinea = (id: number) => setLineas((ls) => ls.filter((l) => l.id !== id));

  const entrada = useMemo<EntradaRentabilidad>(() => {
    const costos: LineaCosto[] = lineas.map((l) => ({
      concepto: l.concepto || 'Costo',
      monto: toNum(l.monto),
      moneda: l.moneda,
    }));
    return {
      precioDocena: toNum(precio),
      docenasCompra: toNum(docenas),
      costosDirectos: costos,
      cotizacionUsd: cotizacion > 0 ? cotizacion : null,
      gastosFijosMensuales: toNum(fijosMensuales),
      docenasEstimadasMes: toNum(docenasMes),
      comisionPct: toNum(comisionPct),
      variableFijoDocena: toNum(variableDocena),
      margenObjetivoPct: toNum(margenObjetivo),
    };
  }, [lineas, precio, docenas, cotizacion, fijosMensuales, docenasMes, comisionPct, variableDocena, margenObjetivo]);

  const resultado = useMemo(() => calcularRentabilidad(entrada), [entrada]);

  const guardarSimulacion = async () => {
    if (!nombre.trim()) {
      toast.error('Poné un nombre o modelo para guardar la simulación');
      return;
    }
    setGuardando(true);
    try {
      const usaDolar = entrada.cotizacionUsd !== null;
      const res = await fetch('/api/admin/costos/simulaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          product_id: productoId || null,
          notas,
          cotizacion_origen: usaDolar ? origenCotizacion : null,
          cotizacion_fecha: usaDolar && origenCotizacion === 'blue' ? dolar?.fecha ?? null : null,
          entrada,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
      toast.success('Simulación guardada en el historial');
      setNotas('');
      setHistorialVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  // Recarga en el formulario una simulación guardada. La cotización que se
  // había usado se restaura como MANUAL: así se reproduce el resultado
  // original en vez de recalcularlo con el dólar de hoy.
  const cargarSimulacion = (s: SimulacionGuardada) => {
    const e = s.inputs;
    setProductoId(catalogo.some((c) => c.product_id === s.product_id) ? (s.product_id as string) : '');
    setNombre(s.nombre);
    setPrecio(String(e.precioDocena));
    setDocenas(String(e.docenasCompra));
    setLineas(
      e.costosDirectos.map((l, i) => ({
        id: i + 1,
        concepto: l.concepto,
        monto: String(l.monto),
        moneda: l.moneda,
        fija: i < 4,
      }))
    );
    if (e.cotizacionUsd) {
      setUsarManual(true);
      setDolarManual(String(e.cotizacionUsd));
    }
    setFijosMensuales(String(e.gastosFijosMensuales));
    setDocenasMes(String(e.docenasEstimadasMes));
    setComisionPct(String(e.comisionPct));
    setVariableDocena(String(e.variableFijoDocena));
    setMargenObjetivo(String(e.margenObjetivoPct));
    toast.success('Simulación cargada. La cotización guardada quedó como manual.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const campo = 'input-base w-full py-1.5';
  const label = 'mb-1 block text-xs text-muted';

  return (
    <div className="space-y-5">
    <div className="grid gap-5 lg:grid-cols-2">
      {/* ───────────── ENTRADAS ───────────── */}
      <div className="space-y-5">
        {/* Producto */}
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">1. Producto y precio de venta</h2>
          <div>
            <label className={label}>Producto del catálogo (solo se usa nombre y precio)</label>
            <select value={productoId} onChange={(e) => elegirProducto(e.target.value)} className={campo}>
              <option value="">— Producto nuevo / manual —</option>
              {catalogo.map((p) => (
                <option key={p.product_id} value={p.product_id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Nombre / modelo</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej: Remera lisa" />
            </div>
            <div>
              <label className={label}>Precio de venta por docena (ARS)</label>
              <input type="number" step="any" min={0} value={precio} onChange={(e) => setPrecio(e.target.value)} className={campo} />
            </div>
          </div>
          <p className="text-xs text-muted">
            Podés cambiar el precio para probar otro valor: es solo para este análisis, no modifica el catálogo.
          </p>
        </div>

        {/* Dólar */}
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">2. Dólar</h2>
            <button onClick={cargarDolar} disabled={dolarLoading} className="btn-ghost py-1">
              <RefreshCw size={14} className={cn(dolarLoading && 'animate-spin')} /> Actualizar
            </button>
          </div>

          {dolar && (
            <p className="text-sm">
              Dólar Blue — venta: <strong>{ars(dolar.venta)}</strong>
              {dolar.compra !== null && <span className="text-muted"> · compra {ars(dolar.compra)}</span>}
              {dolar.fecha && (
                <span className="block text-xs text-muted">
                  Actualizado: {new Date(dolar.fecha).toLocaleString('es-AR')}
                </span>
              )}
            </p>
          )}
          {dolarError && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
              {dolarError}. Ingresá la cotización manualmente.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={usarManual} onChange={(e) => setUsarManual(e.target.checked)} />
            Usar cotización manual
          </label>
          {usarManual && (
            <div>
              <label className={label}>Cotización manual (ARS por USD)</label>
              <input type="number" step="any" min={0} value={dolarManual} onChange={(e) => setDolarManual(e.target.value)} className={campo} placeholder="Ej: 1560" />
            </div>
          )}
          <p className="text-xs text-muted">
            Para convertir USD → ARS se usa el valor de <strong>venta</strong>. Cotización en uso:{' '}
            <strong>{cotizacion > 0 ? `${ars(cotizacion)} (${origenCotizacion})` : 'ninguna'}</strong>
          </p>
        </div>

        {/* Costos directos */}
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">3. Costos directos de la compra</h2>
          <div>
            <label className={label}>Docenas de la compra (cantidad real)</label>
            <input type="number" step="any" min={0} value={docenas} onChange={(e) => setDocenas(e.target.value)} className={campo} placeholder="Ej: 30" />
          </div>
          <div className="space-y-2">
            {lineas.map((l) => (
              <div key={l.id} className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
                <div>
                  {l.fija ? (
                    <label className={label}>{l.concepto}</label>
                  ) : (
                    <input value={l.concepto} onChange={(e) => actualizarLinea(l.id, { concepto: e.target.value })} className={cn(campo, 'mb-1')} />
                  )}
                  <input type="number" step="any" min={0} value={l.monto} onChange={(e) => actualizarLinea(l.id, { monto: e.target.value })} className={campo} placeholder="0" />
                </div>
                <select value={l.moneda} onChange={(e) => actualizarLinea(l.id, { moneda: e.target.value as Moneda })} className="input-base w-auto py-1.5">
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
                {l.fija ? <span className="w-6" /> : (
                  <button onClick={() => quitarLinea(l.id)} className="btn-ghost p-1.5" title="Quitar"><X size={14} /></button>
                )}
              </div>
            ))}
          </div>
          <button onClick={agregarLinea} className="btn-ghost py-1"><Plus size={14} /> Agregar otro costo</button>
          <p className="text-xs text-muted">Cada costo puede estar en ARS o en USD (ej: mercadería en USD y transporte en ARS).</p>
        </div>

        {/* Gastos */}
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">4. Gastos y objetivo</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Comisiones / medios de pago (% del precio)</label>
              <input type="number" step="any" min={0} max={100} value={comisionPct} onChange={(e) => setComisionPct(e.target.value)} className={campo} placeholder="0" />
            </div>
            <div>
              <label className={label}>Otros gastos variables (ARS por docena)</label>
              <input type="number" step="any" min={0} value={variableDocena} onChange={(e) => setVariableDocena(e.target.value)} className={campo} placeholder="0" />
            </div>
            <div>
              <label className={label}>Gastos fijos mensuales (ARS)</label>
              <input type="number" step="any" min={0} value={fijosMensuales} onChange={(e) => setFijosMensuales(e.target.value)} className={campo} />
            </div>
            <div>
              <label className={label}>Docenas estimadas a vender en el mes</label>
              <input type="number" step="any" min={0} value={docenasMes} onChange={(e) => setDocenasMes(e.target.value)} className={campo} />
            </div>
            <div>
              <label className={label}>Margen objetivo (%)</label>
              <input type="number" step="any" min={0} max={99} value={margenObjetivo} onChange={(e) => setMargenObjetivo(e.target.value)} className={campo} />
            </div>
          </div>
          <p className="text-xs text-muted">
            Los gastos fijos y las docenas estimadas vienen de lo que ya cargaste en “Gastos fijos y docenas estimadas”;
            acá los podés ajustar solo para este cálculo.
          </p>
        </div>
      </div>

      {/* ───────────── RESULTADOS ───────────── */}
      <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
        {!resultado.ok ? (
          <div className="card p-4 text-sm text-muted">{resultado.error}</div>
        ) : (
          <>
            <div className={cn('rounded-xl border p-4', VEREDICTOS[resultado.veredicto].clase)}>
              <p className="font-semibold">{VEREDICTOS[resultado.veredicto].titulo}</p>
              {nombre && <p className="text-xs opacity-80">{nombre}</p>}
              <p className="mt-2 text-sm">
                Ganancia por docena: <strong>{ars(resultado.gananciaDocena)}</strong> · Margen:{' '}
                <strong>{pct(resultado.margenPct)}</strong> · Markup: <strong>{pct(resultado.markupPct)}</strong>
              </p>
            </div>

            <div className="card space-y-2 p-4 text-sm">
              <h2 className="font-semibold">Cómo se calcula (por docena)</h2>

              <p className="pt-1 text-xs font-medium uppercase text-muted">Costo directo</p>
              {resultado.lineas.filter((l) => l.monto > 0).map((l, i) => (
                <Fila
                  key={i}
                  k={l.concepto}
                  v={l.moneda === 'USD' ? `USD ${num2(l.monto)} × ${num2(cotizacion)} = ${ars(l.montoArs)}` : ars(l.montoArs)}
                />
              ))}
              <Fila k="Total de la compra" v={ars(resultado.totalDirectoArs)} fuerte />
              <Fila k={`÷ ${num2(toNum(docenas))} docenas = costo directo/docena`} v={ars(resultado.directoDocena)} fuerte />

              <p className="pt-2 text-xs font-medium uppercase text-muted">Gastos</p>
              <Fila k={`Comisiones (${num2(toNum(comisionPct))} % del precio)`} v={ars(resultado.comisionDocena)} />
              <Fila k="Otros gastos variables" v={ars(resultado.variableFijoDocena)} />
              <Fila
                k={`Gastos fijos asignados (${ars(toNum(fijosMensuales))} ÷ ${num2(toNum(docenasMes))} docenas)`}
                v={ars(resultado.fijoDocena)}
              />

              <div className="my-1 border-t border-border" />
              <Fila k="Costo real por docena" v={ars(resultado.costoRealDocena)} fuerte />
              <Fila k="Precio de venta por docena" v={ars(toNum(precio))} />
              <Fila k="Ganancia por docena" v={ars(resultado.gananciaDocena)} fuerte />
              <Fila k="Margen (ganancia ÷ precio)" v={pct(resultado.margenPct)} />
              <Fila k="Markup (ganancia ÷ costo)" v={pct(resultado.markupPct)} />
            </div>

            <div className="card space-y-2 p-4 text-sm">
              <h2 className="font-semibold">¿Está bien el precio?</h2>
              <Fila k="Precio mínimo para no perder" v={resultado.precioMinimo === null ? '—' : ars(resultado.precioMinimo)} />
              <Fila
                k={`Precio para margen objetivo (${num2(toNum(margenObjetivo))} %)`}
                v={resultado.precioObjetivo === null ? '—' : ars(resultado.precioObjetivo)}
              />
              <Fila k="Contribución por docena (precio − directo − variables)" v={ars(resultado.contribucionDocena)} />
              <p className="pt-1">
                {resultado.puntoEquilibrioDocenas === null
                  ? 'Con este precio no se cubren los gastos fijos: no hay punto de equilibrio.'
                  : resultado.puntoEquilibrioDocenas === 0
                    ? 'No hay gastos fijos cargados: no hay punto de equilibrio que calcular.'
                    : `Necesitás vender aproximadamente ${num2(resultado.puntoEquilibrioDocenas)} docenas por mes para cubrir los gastos fijos.`}
              </p>
              {resultado.avisos.map((a, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-400">⚠ {a}</p>
              ))}
            </div>

            <div className="card space-y-2 p-4">
              <h2 className="font-semibold">Guardar en el historial</h2>
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className={campo}
                placeholder="Nota opcional (ej: probando precio con dólar a 1600)"
                maxLength={500}
              />
              <button onClick={guardarSimulacion} disabled={guardando} className="btn-primary">
                <Save size={16} /> {guardando ? 'Guardando…' : 'Guardar simulación'}
              </button>
              <p className="text-xs text-muted">
                Se guarda el nombre, los datos ingresados, el dólar usado y el resultado. No modifica el catálogo.
              </p>
            </div>
          </>
        )}
      </div>
    </div>

    <HistorialSimulaciones version={historialVersion} onCargar={cargarSimulacion} />
    </div>
  );
}

function Fila({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn('min-w-0 break-words', !fuerte && 'text-muted')}>{k}</span>
      <span className={cn('shrink-0 text-right', fuerte && 'font-semibold')}>{v}</span>
    </div>
  );
}