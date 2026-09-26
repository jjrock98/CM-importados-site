'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Plus, RefreshCw, Save, X } from 'lucide-react';
import { cn } from '@/utils';
import {
  AVISO_SIN_DOCENAS_ESTIMADAS,
  calcularRentabilidad,
  round2,
  type EntradaRentabilidad,
  type LineaCosto,
  type Moneda,
  type ResultadoRentabilidad,
  type Veredicto,
} from '@/lib/rentabilidad';
import {
  calcularCompraMultimodelo,
  entradaParaModelo,
  type ComunesRentabilidad,
  type ConfigLonas,
} from '@/lib/lonas';
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

type Modo = 'simple' | 'multi';

interface ConfigForm {
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

interface ModeloForm {
  id: number;
  productId: string;
  modelo: string;
  docenas: string;
  precioDocena: string;
  moneda: Moneda;
  precioVenta: string;
}

const CONFIG_INICIAL: ConfigForm = {
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

const MODELO_VACIO = (id: number): ModeloForm => ({
  id, productId: '', modelo: '', docenas: '', precioDocena: '', moneda: 'ARS', precioVenta: '',
});

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
  const [alquiler, setAlquiler] = useState('');
  const [despensas, setDespensas] = useState('');
  const [diasTrabajados, setDiasTrabajados] = useState('');
  const [pagoPorDia, setPagoPorDia] = useState('');
  const [docenasMes, setDocenasMes] = useState('');
  const [margenObjetivo, setMargenObjetivo] = useState('30');

  const [modo, setModo] = useState<Modo>('simple');
  const [cfg, setCfg] = useState<ConfigForm>(CONFIG_INICIAL);
  const [modelosForm, setModelosForm] = useState<ModeloForm[]>([MODELO_VACIO(1)]);
  const [imprevistos, setImprevistos] = useState('');
  const [imprevistosMoneda, setImprevistosMoneda] = useState<Moneda>('ARS');

  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [historialVersion, setHistorialVersion] = useState(0);
  const [exportando, setExportando] = useState<'csv' | 'excel' | 'pdf' | null>(null);

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

  // Sueldo del único empleado, que se paga por día: días trabajados en el
  // mes × pago por día. Se suma a alquiler + despensas + "otros gastos
  // fijos" (el campo que ya venía del módulo de Costos) para dar el total
  // de gastos fijos mensuales que se prorratea por docena.
  const sueldoEmpleadoMensual = useMemo(
    () => round2(toNum(diasTrabajados) * toNum(pagoPorDia)),
    [diasTrabajados, pagoPorDia]
  );
  const fijosMensualesTotal = useMemo(
    () => round2(toNum(fijosMensuales) + toNum(alquiler) + toNum(despensas) + sueldoEmpleadoMensual),
    [fijosMensuales, alquiler, despensas, sueldoEmpleadoMensual]
  );

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
      gastosFijosMensuales: fijosMensualesTotal,
      docenasEstimadasMes: toNum(docenasMes),
      comisionPct: toNum(comisionPct),
      variableFijoDocena: toNum(variableDocena),
      margenObjetivoPct: toNum(margenObjetivo),
      imprevistos: toNum(imprevistos) > 0 ? { monto: toNum(imprevistos), moneda: imprevistosMoneda } : undefined,
    };
  }, [lineas, precio, docenas, cotizacion, fijosMensualesTotal, docenasMes, comisionPct, variableDocena, margenObjetivo, imprevistos, imprevistosMoneda]);

  const resultado = useMemo(() => calcularRentabilidad(entrada), [entrada]);

  // ── Compra multimodelo ─────────────────────────────────────────────
  const actualizarCfg = (patch: Partial<ConfigForm>) => setCfg((c) => ({ ...c, ...patch }));
  const actualizarModelo = (id: number, patch: Partial<ModeloForm>) =>
    setModelosForm((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const elegirProductoModelo = (id: number, productId: string) => {
    const p = catalogo.find((c) => c.product_id === productId);
    actualizarModelo(id, p
      ? { productId, modelo: p.nombre, precioVenta: String(p.precio_docena_actual) }
      : { productId: '' });
  };

  const modelosActivos = useMemo(() => modelosForm.filter((m) => toNum(m.docenas) > 0), [modelosForm]);

  const docenasAsignadas = useMemo(() => modelosForm.reduce((a, m) => a + toNum(m.docenas), 0), [modelosForm]);
  const diferenciaLive = Math.round((toNum(cfg.docenasTotales) - docenasAsignadas) * 100) / 100;

  // Subtotal de un renglón (docenas × precio de la docena), en su moneda y en ARS.
  const subtotalModelo = (m: ModeloForm) => {
    const orig = toNum(m.docenas) * toNum(m.precioDocena);
    return { orig, ars: m.moneda === 'USD' ? (cotizacion > 0 ? orig * cotizacion : null) : orig };
  };

  // Total de la mercadería en ARS; null si hay USD y todavía no hay cotización.
  const mercaderiaLive = useMemo(() => {
    let total = 0;
    for (const m of modelosForm) {
      const sub = toNum(m.docenas) * toNum(m.precioDocena);
      if (m.moneda === 'USD' && sub > 0) {
        if (!(cotizacion > 0)) return null;
        total += sub * cotizacion;
      } else {
        total += sub;
      }
    }
    return total;
  }, [modelosForm, cotizacion]);

  const compra = useMemo(() => {
    const config: ConfigLonas = {
      docenasTotales: toNum(cfg.docenasTotales),
      docenasPorLona: toNum(cfg.docenasPorLona),
      costoLona: toNum(cfg.costoLona),
      monedaLona: cfg.monedaLona,
      redondearLonas: cfg.redondearLonas,
      costoEnvioLona: toNum(cfg.costoEnvioLona),
      monedaEnvio: cfg.monedaEnvio,
      redondearEnvio: cfg.redondearEnvio,
      recargoPct: cfg.aplicarRecargo ? toNum(cfg.recargoPct) : 0,
      recargoFijo: toNum(cfg.recargoFijo),
      monedaRecargoFijo: cfg.monedaRecargoFijo,
      imprevistos: toNum(imprevistos),
      monedaImprevistos: imprevistosMoneda,
    };
    return calcularCompraMultimodelo(
      config,
      modelosActivos.map((m) => ({
        modelo: m.modelo.trim(),
        docenas: toNum(m.docenas),
        precioDocena: toNum(m.precioDocena),
        moneda: m.moneda,
        precioVenta: toNum(m.precioVenta),
      })),
      cotizacion > 0 ? cotizacion : null
    );
  }, [cfg, modelosActivos, imprevistos, imprevistosMoneda, cotizacion]);

  const comunes = useMemo<ComunesRentabilidad>(() => ({
    cotizacionUsd: cotizacion > 0 ? cotizacion : null,
    gastosFijosMensuales: fijosMensualesTotal,
    docenasEstimadasMes: toNum(docenasMes),
    comisionPct: toNum(comisionPct),
    variableFijoDocena: toNum(variableDocena),
    margenObjetivoPct: toNum(margenObjetivo),
  }), [cotizacion, fijosMensualesTotal, docenasMes, comisionPct, variableDocena, margenObjetivo]);

  const analisis = useMemo(() => {
    if (!compra.ok) return [];
    return compra.modelos.map((m, i) => ({
      m,
      productId: modelosActivos[i]?.productId ?? '',
      entrada: entradaParaModelo(m, comunes),
      res: m.precioVenta > 0 ? calcularRentabilidad(entradaParaModelo(m, comunes)) : null,
    }));
  }, [compra, comunes, modelosActivos]);

  const exportarMultimodelo = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!compra.ok) return;
    setExportando(format);
    try {
      const modelosBody = compra.modelos.map((m, i) => {
        const res = analisis[i]?.res;
        return {
          modelo: m.modelo, docenas: m.docenas, precioDocenaArs: m.precioDocenaArs,
          mercaderiaArs: m.mercaderiaArs, lonasArs: m.lonasArs, envioArs: m.envioArs,
          recargosArs: m.recargosArs, directoTotalArs: m.directoTotalArs, directoDocena: m.directoDocena,
          imprevistosArs: m.imprevistosArs, precioVenta: m.precioVenta,
          costoRealDocena: res && res.ok ? res.costoRealDocena : null,
          gananciaDocena: res && res.ok ? res.gananciaDocena : null,
          margenPct: res && res.ok ? res.margenPct : null,
          markupPct: res && res.ok ? res.markupPct : null,
          precioRecomendado: res && res.ok ? res.precioRecomendado : null,
          veredicto: res && res.ok ? res.veredicto : null,
        };
      });
      const body = {
        nombre: nombre || 'Compra multimodelo',
        fecha: new Date().toISOString(),
        docenasTotales: compra.docenasTotales,
        docenasDeclaradas: compra.docenasDeclaradas,
        lonasUsadas: compra.lonasUsadas,
        lonasCobradas: compra.lonasCobradas,
        bultosEnvio: compra.bultosEnvio,
        lonaUnitariaArs: compra.lonaUnitariaArs,
        envioUnitarioArs: compra.envioUnitarioArs,
        costoLonasArs: compra.costoLonasArs,
        costoEnvioArs: compra.costoEnvioArs,
        mercaderiaTotalArs: compra.mercaderiaTotalArs,
        recargoPctArs: compra.recargoPctArs,
        mercaderiaConRecargoArs: compra.mercaderiaConRecargoArs,
        recargoFijoArs: compra.recargoFijoArs,
        costoDirectoTotalArs: compra.costoDirectoTotalArs,
        imprevistosArs: compra.imprevistosArs,
        modelos: modelosBody,
      };
      const res = await fetch(`/api/admin/costos/export/multimodelo?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'excel' ? 'xlsx' : format;
      const slug = (nombre || 'compra-multimodelo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      a.download = `${slug}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      const label = format === 'pdf' ? 'PDF' : format === 'excel' ? 'Excel' : 'CSV';
      toast.error(`No se pudo generar el ${label}`);
    } finally {
      setExportando(null);
    }
  };

  const guardarSimulacion = async () => {
    if (!nombre.trim()) {
      toast.error('Poné un nombre o modelo para guardar la simulación');
      return;
    }
    setGuardando(true);
    try {
      const usaDolar = cotizacion > 0;
      const meta = {
        notas,
        cotizacion_origen: usaDolar ? origenCotizacion : null,
        cotizacion_fecha: usaDolar && origenCotizacion === 'blue' ? dolar?.fecha ?? null : null,
      };
      // Desglose de gastos fijos (otros + alquiler + despensas + sueldo por
      // día del empleado) tal como se cargó en el formulario, para poder
      // reconstruirlo exacto al recargar la simulación desde el historial.
      const desagregadoFijos = { fijosMensuales, alquiler, despensas, diasTrabajados, pagoPorDia };

      let payload: Record<string, unknown>;
      if (modo === 'multi') {
        const analizables = analisis.filter((a) => a.res !== null);
        if (compra.ok && compra.docenasDeclaradas !== null && compra.diferenciaDocenas !== 0) {
          throw new Error(
            `Las docenas por modelo (${num2(compra.docenasTotales)}) no coinciden con el total de la compra (${num2(compra.docenasDeclaradas)})`
          );
        }
        if (!compra.ok || analizables.length === 0) {
          throw new Error('Cargá el precio de venta pretendido de al menos un modelo para guardar');
        }
        payload = {
          ...meta,
          items: analizables.map((a) => ({
            nombre: `${nombre.trim()} — ${a.m.modelo}`,
            product_id: a.productId || null,
            entrada: a.entrada,
          })),
          compra: {
            tipo: 'multimodelo',
            form: { cfg, modelos: modelosForm, imprevistos, imprevistosMoneda },
            desglose: compra,
            desagregadoFijos,
          },
        };
      } else {
        payload = {
          ...meta,
          nombre,
          product_id: productoId || null,
          entrada,
          compra: { tipo: 'simple', desagregadoFijos },
        };
      }

      const res = await fetch('/api/admin/costos/simulaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    const form = (s.compra as { form?: { cfg: ConfigForm; modelos: ModeloForm[]; imprevistos: string; imprevistosMoneda: Moneda } } | null)?.form;
    if (s.compra?.tipo === 'multimodelo' && form) {
      setModo('multi');
      setCfg({ ...CONFIG_INICIAL, ...form.cfg, aplicarRecargo: form.cfg.aplicarRecargo ?? toNum(form.cfg.recargoPct) > 0 });
      setModelosForm(form.modelos);
      setImprevistos(form.imprevistos);
      setImprevistosMoneda(form.imprevistosMoneda);
      setNombre(s.nombre.split(' — ')[0]);
    } else {
      setModo('simple');
      setImprevistos(e.imprevistos ? String(e.imprevistos.monto) : '');
      setImprevistosMoneda(e.imprevistos?.moneda ?? 'ARS');
      setNombre(s.nombre);
    }
    setProductoId(catalogo.some((c) => c.product_id === s.product_id) ? (s.product_id as string) : '');
    if (!(s.compra?.tipo === 'multimodelo' && form)) {
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
    }
    if (e.cotizacionUsd) {
      setUsarManual(true);
      setDolarManual(String(e.cotizacionUsd));
    }
    const desagregado = (s.compra as { desagregadoFijos?: Record<string, string> } | null)?.desagregadoFijos;
    if (desagregado) {
      setFijosMensuales(desagregado.fijosMensuales ?? String(e.gastosFijosMensuales));
      setAlquiler(desagregado.alquiler ?? '');
      setDespensas(desagregado.despensas ?? '');
      setDiasTrabajados(desagregado.diasTrabajados ?? '');
      setPagoPorDia(desagregado.pagoPorDia ?? '');
    } else {
      // simulaciones guardadas antes de este desglose: el total viejo va
      // entero a "otros gastos fijos", sin alquiler/despensas/sueldo aparte.
      setFijosMensuales(String(e.gastosFijosMensuales));
      setAlquiler('');
      setDespensas('');
      setDiasTrabajados('');
      setPagoPorDia('');
    }
    setDocenasMes(String(e.docenasEstimadasMes));
    setComisionPct(String(e.comisionPct));
    setVariableDocena(String(e.variableFijoDocena));
    setMargenObjetivo(String(e.margenObjetivoPct));
    toast.success('Simulación cargada. La cotización guardada quedó como manual.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const campo = 'input-base w-full py-1.5';
  const label = 'mb-1 block text-xs text-muted';

  const tarjetaGuardar = (
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
        {modo === 'multi'
            ? 'Se guarda una fila por cada modelo con precio pretendido, junto con el desglose de lonas y prorrateo. No modifica el catálogo.'
            : 'Se guarda el nombre, los datos ingresados, el dólar usado y el resultado. No modifica el catálogo.'}
      </p>
    </div>
  );

  const resultadosMulti = !compra.ok ? (
    <div className="card p-4 text-sm text-muted">{compra.error}</div>
  ) : (
    <>
      <div className="card space-y-2 p-4 text-sm">
        <h2 className="font-semibold">Desglose de la compra</h2>
        {compra.docenasDeclaradas !== null && <Fila k="Total de docenas de la compra" v={num2(compra.docenasDeclaradas)} />}
        <Fila k="Docenas detalladas por modelo" v={num2(compra.docenasTotales)} />
        {compra.diferenciaDocenas !== 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            ⚠ Las docenas por modelo no coinciden con el total de la compra (diferencia: {num2(compra.diferenciaDocenas)}). No se puede guardar hasta que coincidan.
          </p>
        )}
        <Fila k="Mercadería (suma de modelos)" v={ars(compra.mercaderiaTotalArs)} />
        {compra.recargoPctArs > 0 && (
          <Fila k={`Recargo ${num2(toNum(cfg.recargoPct))} % sobre la mercadería`} v={ars(compra.recargoPctArs)} />
        )}
        <Fila k="Mercadería con recargo" v={ars(compra.mercaderiaConRecargoArs)} fuerte />
        <Fila
          k={`Lonas usadas (${num2(compra.docenasTotales)} ÷ ${num2(toNum(cfg.docenasPorLona))} docenas por lona)`}
          v={num2(compra.lonasUsadas)}
        />
        <Fila k={`Costo de lonas (${num2(compra.lonasCobradas)} × ${ars(compra.lonaUnitariaArs)})`} v={ars(compra.costoLonasArs)} />
        <Fila k={`Envío (${num2(compra.bultosEnvio)} bultos × ${ars(compra.envioUnitarioArs)})`} v={ars(compra.costoEnvioArs)} />
        {compra.recargoFijoArs > 0 && <Fila k="Otro recargo fijo" v={ars(compra.recargoFijoArs)} />}
        <Fila k="Costo directo total de la compra" v={ars(compra.costoDirectoTotalArs)} fuerte />
        {compra.imprevistosArs > 0 && <Fila k="Imprevistos (solo entran al costo real)" v={ars(compra.imprevistosArs)} />}
        <p className="pt-1 text-xs text-muted">
          El recargo % lo carga cada modelo sobre su propia mercadería; lonas, envío y recargo fijo se reparten en proporción a las docenas.
        </p>
        {fijosMensualesTotal > 0 && toNum(docenasMes) <= 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            ⚠ {AVISO_SIN_DOCENAS_ESTIMADAS}
            {docenasAsignadas > 0 && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => setDocenasMes(String(docenasAsignadas))}
                  className="underline underline-offset-2 hover:opacity-80"
                >
                  Usar las {num2(docenasAsignadas)} docenas de esta compra como estimación
                </button>
                .
              </>
            )}
          </p>
        )}
      </div>

      {analisis.map(({ m, res }, i) => (
        <div key={i} className="card space-y-2 p-4 text-sm">
          <h2 className="break-words font-semibold">{m.modelo}</h2>
          <Fila k={`${num2(m.docenas)} docenas × ${ars(m.precioDocenaArs)}`} v={ars(m.mercaderiaArs)} />
          <Fila k="+ Lonas (prorrateo)" v={ars(m.lonasArs)} />
          <Fila k="+ Envío (prorrateo)" v={ars(m.envioArs)} />
          <Fila k="+ Recargos" v={ars(m.recargosArs)} />
          <Fila k="Costo directo del modelo" v={ars(m.directoTotalArs)} fuerte />
          <Fila k={`÷ ${num2(m.docenas)} docenas = costo directo/docena`} v={ars(m.directoDocena)} fuerte />

          {res === null && (
            <p className="pt-1 text-xs text-muted">Cargá el precio de venta pretendido para analizar si es viable.</p>
          )}
          {res && !res.ok && <p className="pt-1 text-xs text-red-600">{res.error}</p>}
          {res && res.ok && (
            <IndicadoresPrecio
              res={res}
              precio={m.precioVenta}
              comisionPct={toNum(comisionPct)}
              fijosMensuales={fijosMensualesTotal}
              docenasMes={toNum(docenasMes)}
              margenObjetivo={toNum(margenObjetivo)}
            />
          )}
        </div>
      ))}

      <div className="card space-y-2 p-4">
        <h2 className="flex items-center gap-2 font-semibold"><Download size={16} /> Exportar esta compra</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => exportarMultimodelo('csv')} disabled={exportando !== null} className="btn-ghost">
            {exportando === 'csv' ? 'Generando…' : 'CSV'}
          </button>
          <button onClick={() => exportarMultimodelo('excel')} disabled={exportando !== null} className="btn-ghost">
            {exportando === 'excel' ? 'Generando…' : 'Excel'}
          </button>
          <button onClick={() => exportarMultimodelo('pdf')} disabled={exportando !== null} className="btn-ghost">
            {exportando === 'pdf' ? 'Generando…' : 'PDF'}
          </button>
        </div>
        <p className="text-xs text-muted">Exporta el detalle por modelo y el resumen de esta compra, tal como se ve en pantalla.</p>
      </div>

      {tarjetaGuardar}
    </>
  );

  return (
    <div className="space-y-5">
    <div className="grid gap-5 lg:grid-cols-2">
      {/* ───────────── ENTRADAS ───────────── */}
      <div className="space-y-5">
        <div className="card flex gap-2 p-2">
          {(['simple', 'multi'] as Modo[]).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={cn('flex-1 justify-center', modo === m ? 'btn-primary' : 'btn-ghost')}
            >
              {m === 'simple' ? 'Un producto' : 'Compra multimodelo (lonas)'}
            </button>
          ))}
        </div>

        {modo === 'simple' ? (
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
        ) : (
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">1. Compra</h2>
          <div>
            <label className={label}>Nombre de la compra / lona</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej: Lona 24/09" />
          </div>
          <p className="text-xs text-muted">
            Cada modelo lleva su precio de venta pretendido; el precio del catálogo solo sirve de referencia y no se modifica.
          </p>
        </div>
        )}

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

        {modo === 'simple' ? (
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
        ) : (
        <>
          {/* 3. Mercadería: lista renglón por renglón */}
          <div className="card space-y-3 p-4">
            <h2 className="font-semibold">3. Mercadería de la compra</h2>
            <div>
              <label className={label}>Total de docenas de la compra (opcional: te avisa si no coincide con el detalle)</label>
              <input type="number" step="any" min={0} value={cfg.docenasTotales} onChange={(e) => actualizarCfg({ docenasTotales: e.target.value })} className={campo} placeholder="Ej: 36" />
            </div>
            {toNum(cfg.docenasTotales) > 0 && (
              <p className={cn(
                'rounded-lg border p-2 text-xs',
                diferenciaLive === 0
                  ? 'border-green-300 bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-300'
                  : 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300'
              )}>
                Detalladas: {num2(docenasAsignadas)} de {num2(toNum(cfg.docenasTotales))} docenas ·{' '}
                {diferenciaLive === 0
                  ? 'coincide con el total ✔'
                  : diferenciaLive > 0
                    ? `faltan ${num2(diferenciaLive)} docenas por asignar`
                    : `te pasaste por ${num2(-diferenciaLive)} docenas`}
              </p>
            )}
            <p className="text-xs text-muted">
              Cargá un renglón por producto: docenas, nombre y precio de la docena. El subtotal se calcula solo.
            </p>

            {modelosForm.map((m, idx) => {
              const sub = subtotalModelo(m);
              return (
                <div key={m.id} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-xs text-muted">{idx + 1}.</span>
                    <select value={m.productId} onChange={(e) => elegirProductoModelo(m.id, e.target.value)} className="input-base min-w-0 flex-1 py-1 text-xs">
                      <option value="">Modelo nuevo / manual</option>
                      {catalogo.map((p) => (
                        <option key={p.product_id} value={p.product_id}>Traer del catálogo: {p.nombre}</option>
                      ))}
                    </select>
                    {modelosForm.length > 1 && (
                      <button onClick={() => setModelosForm((ms) => ms.filter((x) => x.id !== m.id))} className="btn-ghost p-1.5" title="Quitar renglón">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-[6rem_1fr] gap-2">
                    <div>
                      <label className={label}>Docenas</label>
                      <input type="number" step="any" min={0} value={m.docenas} onChange={(e) => actualizarModelo(m.id, { docenas: e.target.value })} className={campo} placeholder="5" />
                    </div>
                    <div>
                      <label className={label}>Producto / modelo</label>
                      <input value={m.modelo} onChange={(e) => actualizarModelo(m.id, { modelo: e.target.value })} className={campo} placeholder="Ej: Jordan 40-45" />
                    </div>
                  </div>
                  <CampoMonto label="Precio de la docena" valor={m.precioDocena} moneda={m.moneda}
                    onValor={(v) => actualizarModelo(m.id, { precioDocena: v })} onMoneda={(mo) => actualizarModelo(m.id, { moneda: mo })} />
                  <div className="flex items-baseline justify-between gap-3 rounded-md bg-surface-2 px-2 py-1.5 text-sm">
                    <span className="text-muted">
                      {num2(toNum(m.docenas))} docenas × {m.moneda === 'USD' ? `USD ${num2(toNum(m.precioDocena))}` : ars(toNum(m.precioDocena))}
                    </span>
                    <span className="text-right font-semibold">
                      {ars(sub.orig).replace('$', m.moneda === 'USD' ? 'US$' : '$')}
                      {m.moneda === 'USD' && sub.ars !== null && (
                        <span className="block text-xs font-normal text-muted">≈ {ars(sub.ars)}</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <label className={label}>Precio de venta pretendido por docena, en ARS (opcional, para ver si conviene)</label>
                    <input type="number" step="any" min={0} value={m.precioVenta} onChange={(e) => actualizarModelo(m.id, { precioVenta: e.target.value })} className={campo} />
                  </div>
                </div>
              );
            })}

            <button onClick={() => setModelosForm((ms) => [...ms, MODELO_VACIO(Date.now())])} className="btn-ghost py-1">
              <Plus size={14} /> Agregar otro producto
            </button>

            <div className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted">Total de docenas</span>
                <span className="font-semibold">{num2(docenasAsignadas)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted">Total de la mercadería</span>
                <span className="font-semibold">{mercaderiaLive === null ? 'falta la cotización del dólar' : ars(mercaderiaLive)}</span>
              </div>
            </div>
          </div>

          {/* 4. Recargo opcional sobre el total de la mercadería */}
          <div className="card space-y-3 p-4">
            <h2 className="font-semibold">4. Recargo (opcional)</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cfg.aplicarRecargo} onChange={(e) => actualizarCfg({ aplicarRecargo: e.target.checked })} />
              Compra a distancia (el proveedor cobra un recargo)
            </label>
            {cfg.aplicarRecargo && (
              <div>
                <label className={label}>Recargo (% sobre el total de la mercadería)</label>
                <input type="number" step="any" min={0} value={cfg.recargoPct} onChange={(e) => actualizarCfg({ recargoPct: e.target.value })} className={campo} placeholder="Ej: 1.5" />
                {mercaderiaLive !== null && toNum(cfg.recargoPct) > 0 && (
                  <p className="mt-2 rounded-md bg-surface-2 px-2 py-1.5 text-sm">
                    {num2(toNum(cfg.recargoPct))} % de {ars(mercaderiaLive)} = <strong>{ars(mercaderiaLive * toNum(cfg.recargoPct) / 100)}</strong>
                    <span className="block text-muted">
                      Mercadería con recargo: <strong className="text-inherit">{ars(mercaderiaLive * (1 + toNum(cfg.recargoPct) / 100))}</strong>
                    </span>
                  </p>
                )}
                <p className="mt-1 text-xs text-muted">
                  Se aplica solo a las docenas, antes de lonas y envío. Cambialo según el proveedor; si compraste en persona, dejalo desmarcado.
                </p>
              </div>
            )}
            <CampoMonto label="Otro recargo fijo (opcional)" valor={cfg.recargoFijo} moneda={cfg.monedaRecargoFijo}
              onValor={(v) => actualizarCfg({ recargoFijo: v })} onMoneda={(m) => actualizarCfg({ monedaRecargoFijo: m })} />
          </div>

          {/* 5. Lonas y envío */}
          <div className="card space-y-3 p-4">
            <h2 className="font-semibold">5. Lonas y envío</h2>
            <div>
              <label className={label}>Docenas máximas por lona</label>
              <input type="number" step="any" min={0} value={cfg.docenasPorLona} onChange={(e) => actualizarCfg({ docenasPorLona: e.target.value })} className={campo} placeholder="Ej: 24 a 30" />
            </div>
            <CampoMonto label="Costo de la lona (material, por lona)" valor={cfg.costoLona} moneda={cfg.monedaLona}
              onValor={(v) => actualizarCfg({ costoLona: v })} onMoneda={(m) => actualizarCfg({ monedaLona: m })} />
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={cfg.redondearLonas} onChange={(e) => actualizarCfg({ redondearLonas: e.target.checked })} />
              Cobrar lonas enteras (redondear hacia arriba)
            </label>
            <CampoMonto label="Envío (tarifa por lona)" valor={cfg.costoEnvioLona} moneda={cfg.monedaEnvio}
              onValor={(v) => actualizarCfg({ costoEnvioLona: v })} onMoneda={(m) => actualizarCfg({ monedaEnvio: m })} />
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={cfg.redondearEnvio} onChange={(e) => actualizarCfg({ redondearEnvio: e.target.checked })} />
              El transporte cobra por lona entera (redondear hacia arriba)
            </label>
          </div>
        </>
        )}

        {/* Gastos */}
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">{modo === 'simple' ? '4' : '6'}. Gastos, imprevistos y objetivo</h2>
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
              <label className={label}>Otros gastos fijos mensuales (ARS)</label>
              <input type="number" step="any" min={0} value={fijosMensuales} onChange={(e) => setFijosMensuales(e.target.value)} className={campo} />
            </div>
            <div>
              <label className={label}>Docenas estimadas a vender en el mes</label>
              <input type="number" step="any" min={0} value={docenasMes} onChange={(e) => setDocenasMes(e.target.value)} className={campo} />
            </div>
            <div>
              <label className={label}>Alquiler mensual (ARS)</label>
              <input type="number" step="any" min={0} value={alquiler} onChange={(e) => setAlquiler(e.target.value)} className={campo} placeholder="0" />
            </div>
            <div>
              <label className={label}>Despensas / insumos mensuales (ARS)</label>
              <input type="number" step="any" min={0} value={despensas} onChange={(e) => setDespensas(e.target.value)} className={campo} placeholder="0" />
            </div>
            <CampoMonto label="Gastos imprevistos del lote (opcional)" valor={imprevistos} moneda={imprevistosMoneda}
              onValor={setImprevistos} onMoneda={setImprevistosMoneda} />
            <div>
              <label className={label}>Margen objetivo (%)</label>
              <input type="number" step="any" min={0} max={99} value={margenObjetivo} onChange={(e) => setMargenObjetivo(e.target.value)} className={campo} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Sueldo del empleado (se paga por día)</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>Días trabajados en el mes</label>
                <input type="number" step="any" min={0} max={31} value={diasTrabajados} onChange={(e) => setDiasTrabajados(e.target.value)} className={campo} placeholder="Ej: 24" />
              </div>
              <div>
                <label className={label}>Pago por día (ARS)</label>
                <input type="number" step="any" min={0} value={pagoPorDia} onChange={(e) => setPagoPorDia(e.target.value)} className={campo} placeholder="Ej: 15000" />
              </div>
            </div>
            {sueldoEmpleadoMensual > 0 && (
              <p className="mt-2 text-xs text-muted">
                {num2(toNum(diasTrabajados))} días × {ars(toNum(pagoPorDia))} = <strong className="text-inherit">{ars(sueldoEmpleadoMensual)}</strong> ese mes
              </p>
            )}
          </div>

          <div className="rounded-md bg-surface-2 px-3 py-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted">Total gastos fijos mensuales (otros + alquiler + despensas + sueldo)</span>
              <span className="font-semibold">{ars(fijosMensualesTotal)}</span>
            </div>
          </div>

          <p className="text-xs text-muted">
            “Otros gastos fijos” y las docenas estimadas vienen de lo que ya cargaste en “Gastos fijos y docenas estimadas”;
            acá los podés ajustar solo para este cálculo. Alquiler, despensas y el sueldo del empleado se suman aparte y entran
            igual al prorrateo por docena.
          </p>
        </div>
      </div>

      {/* ───────────── RESULTADOS ───────────── */}
      <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
        {modo === 'multi' ? resultadosMulti : !resultado.ok ? (
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
                k={`Gastos fijos asignados (${ars(fijosMensualesTotal)} ÷ ${num2(toNum(docenasMes))} docenas)`}
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
              <Fila
                k="Precio recomendado (redondeado hacia arriba)"
                v={resultado.precioRecomendado === null ? '—' : ars(resultado.precioRecomendado)}
                fuerte
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

            {tarjetaGuardar}
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

function CampoMonto({
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
function IndicadoresPrecio({
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