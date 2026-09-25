import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { formatPrice } from '@/utils';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return profile?.rol === 'admin' ? user : null;
}

interface ModeloExport {
  modelo: string;
  docenas: number;
  precioDocenaArs: number;
  mercaderiaArs: number;
  lonasArs: number;
  envioArs: number;
  recargosArs: number;
  directoTotalArs: number;
  directoDocena: number;
  imprevistosArs: number;
  precioVenta: number;
  costoRealDocena: number | null;
  gananciaDocena: number | null;
  margenPct: number | null;
  markupPct: number | null;
  veredicto: 'optimo' | 'bajo_objetivo' | 'perdida' | null;
}

interface CompraExport {
  nombre: string;
  fecha: string;
  docenasTotales: number;
  docenasDeclaradas: number | null;
  lonasUsadas: number;
  lonasCobradas: number;
  bultosEnvio: number;
  lonaUnitariaArs: number;
  envioUnitarioArs: number;
  costoLonasArs: number;
  costoEnvioArs: number;
  mercaderiaTotalArs: number;
  recargoPctArs: number;
  mercaderiaConRecargoArs: number;
  recargoFijoArs: number;
  costoDirectoTotalArs: number;
  imprevistosArs: number;
  modelos: ModeloExport[];
}

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const esNumeroONull = (v: unknown): v is number | null => v === null || esNumero(v);
const VEREDICTOS = ['optimo', 'bajo_objetivo', 'perdida'] as const;

/** Valida y normaliza el body — nunca confía en los números que llegan del cliente. */
function normalizar(raw: unknown): CompraExport | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;

  if (!Array.isArray(b.modelos) || b.modelos.length === 0 || b.modelos.length > 30) return null;

  const modelos: ModeloExport[] = [];
  for (const m of b.modelos) {
    const x = m as Record<string, unknown>;
    if (
      typeof x.modelo !== 'string' ||
      !esNumero(x.docenas) || !esNumero(x.precioDocenaArs) || !esNumero(x.mercaderiaArs) ||
      !esNumero(x.lonasArs) || !esNumero(x.envioArs) || !esNumero(x.recargosArs) ||
      !esNumero(x.directoTotalArs) || !esNumero(x.directoDocena) || !esNumero(x.imprevistosArs) ||
      !esNumero(x.precioVenta) ||
      !esNumeroONull(x.costoRealDocena) || !esNumeroONull(x.gananciaDocena) ||
      !esNumeroONull(x.margenPct) || !esNumeroONull(x.markupPct) ||
      !(x.veredicto === null || VEREDICTOS.includes(x.veredicto as typeof VEREDICTOS[number]))
    ) return null;

    modelos.push({
      modelo: x.modelo.trim().slice(0, 80) || 'Modelo',
      docenas: x.docenas, precioDocenaArs: x.precioDocenaArs, mercaderiaArs: x.mercaderiaArs,
      lonasArs: x.lonasArs, envioArs: x.envioArs, recargosArs: x.recargosArs,
      directoTotalArs: x.directoTotalArs, directoDocena: x.directoDocena, imprevistosArs: x.imprevistosArs,
      precioVenta: x.precioVenta, costoRealDocena: x.costoRealDocena, gananciaDocena: x.gananciaDocena,
      margenPct: x.margenPct, markupPct: x.markupPct,
      veredicto: x.veredicto as ModeloExport['veredicto'],
    });
  }

  const camposNumericos = [
    'docenasTotales', 'lonasUsadas', 'lonasCobradas', 'bultosEnvio', 'lonaUnitariaArs',
    'envioUnitarioArs', 'costoLonasArs', 'costoEnvioArs', 'mercaderiaTotalArs', 'recargoPctArs',
    'mercaderiaConRecargoArs', 'recargoFijoArs', 'costoDirectoTotalArs', 'imprevistosArs',
  ] as const;
  for (const campo of camposNumericos) {
    if (!esNumero(b[campo])) return null;
  }
  if (!esNumeroONull(b.docenasDeclaradas)) return null;

  return {
    nombre: typeof b.nombre === 'string' && b.nombre.trim() ? b.nombre.trim().slice(0, 120) : 'Compra multimodelo',
    fecha: typeof b.fecha === 'string' ? b.fecha : new Date().toISOString(),
    docenasTotales: b.docenasTotales as number,
    docenasDeclaradas: b.docenasDeclaradas as number | null,
    lonasUsadas: b.lonasUsadas as number,
    lonasCobradas: b.lonasCobradas as number,
    bultosEnvio: b.bultosEnvio as number,
    lonaUnitariaArs: b.lonaUnitariaArs as number,
    envioUnitarioArs: b.envioUnitarioArs as number,
    costoLonasArs: b.costoLonasArs as number,
    costoEnvioArs: b.costoEnvioArs as number,
    mercaderiaTotalArs: b.mercaderiaTotalArs as number,
    recargoPctArs: b.recargoPctArs as number,
    mercaderiaConRecargoArs: b.mercaderiaConRecargoArs as number,
    recargoFijoArs: b.recargoFijoArs as number,
    costoDirectoTotalArs: b.costoDirectoTotalArs as number,
    imprevistosArs: b.imprevistosArs as number,
    modelos,
  };
}

const VEREDICTO_TXT: Record<string, string> = {
  optimo: 'Rentable', bajo_objetivo: 'Bajo objetivo', perdida: 'Pérdida', '—': '—',
};

function csvCell(value: string | number): string {
  const str = String(value);
  return /[",;\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * POST /api/admin/costos/export/multimodelo?format=csv|excel|pdf
 *
 * Exporta el desglose de UNA compra multimodelo (lonas + envío + recargo +
 * costo directo/real por modelo) tal como se calculó en pantalla. La compra
 * no vive en la base — este endpoint recibe el resultado ya calculado por
 * el cliente (lib/lonas.ts + lib/rentabilidad.ts) y solo lo formatea, sin
 * volver a tocar el catálogo ni ninguna otra tabla.
 */
export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const format = req.nextUrl.searchParams.get('format');
  if (!format || !['csv', 'excel', 'pdf'].includes(format)) {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const compra = normalizar(body);
  if (!compra) return NextResponse.json({ error: 'Datos de la compra inválidos' }, { status: 400 });

  const slug = compra.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'compra';

  if (format === 'csv') {
    const headers = [
      'Modelo', 'Docenas', 'Precio compra/docena', 'Mercadería', 'Lonas (prorrateo)',
      'Envío (prorrateo)', 'Recargos', 'Costo directo total', 'Costo directo/docena',
      'Imprevistos', 'Precio venta pretendido', 'Costo real/docena', 'Ganancia/docena',
      'Margen %', 'Markup %', 'Veredicto',
    ];
    const lines = [headers.map(csvCell).join(',')];
    for (const m of compra.modelos) {
      lines.push([
        m.modelo, m.docenas, m.precioDocenaArs, m.mercaderiaArs, m.lonasArs, m.envioArs,
        m.recargosArs, m.directoTotalArs, m.directoDocena, m.imprevistosArs, m.precioVenta,
        m.costoRealDocena ?? '', m.gananciaDocena ?? '', m.margenPct ?? '', m.markupPct ?? '',
        VEREDICTO_TXT[m.veredicto ?? '—'],
      ].map(csvCell).join(','));
    }
    lines.push('');
    lines.push(['Resumen de la compra', ''].map(csvCell).join(','));
    lines.push(['Total de docenas', compra.docenasTotales].map(csvCell).join(','));
    lines.push(['Mercadería total', compra.mercaderiaTotalArs].map(csvCell).join(','));
    if (compra.recargoPctArs > 0) lines.push(['Recargo sobre mercadería', compra.recargoPctArs].map(csvCell).join(','));
    lines.push(['Lonas usadas', compra.lonasUsadas].map(csvCell).join(','));
    lines.push(['Costo de lonas', compra.costoLonasArs].map(csvCell).join(','));
    lines.push(['Costo de envío', compra.costoEnvioArs].map(csvCell).join(','));
    lines.push(['Costo directo total de la compra', compra.costoDirectoTotalArs].map(csvCell).join(','));

    const csv = '\uFEFF' + lines.join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}.csv"`,
      },
    });
  }

  if (format === 'excel') {
    const headers = [
      'Modelo', 'Docenas', 'Precio compra/docena', 'Mercadería', 'Lonas (prorrateo)',
      'Envío (prorrateo)', 'Recargos', 'Costo directo total', 'Costo directo/docena',
      'Imprevistos', 'Precio venta pretendido', 'Costo real/docena', 'Ganancia/docena',
      'Margen %', 'Markup %', 'Veredicto',
    ];
    const aoa: (string | number)[][] = [headers];
    for (const m of compra.modelos) {
      aoa.push([
        m.modelo, m.docenas, m.precioDocenaArs, m.mercaderiaArs, m.lonasArs, m.envioArs,
        m.recargosArs, m.directoTotalArs, m.directoDocena, m.imprevistosArs, m.precioVenta,
        m.costoRealDocena ?? '', m.gananciaDocena ?? '', m.margenPct ?? '', m.markupPct ?? '',
        VEREDICTO_TXT[m.veredicto ?? '—'],
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map((h) => ({ wch: h === 'Modelo' ? 28 : 16 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle por modelo');

    const wsResumen = XLSX.utils.aoa_to_sheet([
      ['Compra', compra.nombre],
      ['Fecha', new Date(compra.fecha).toLocaleString('es-AR')],
      [],
      ['Total de docenas', compra.docenasTotales],
      ...(compra.docenasDeclaradas !== null ? [['Docenas declaradas', compra.docenasDeclaradas]] : []),
      ['Mercadería total', compra.mercaderiaTotalArs],
      ...(compra.recargoPctArs > 0 ? [['Recargo sobre mercadería', compra.recargoPctArs]] : []),
      ['Mercadería con recargo', compra.mercaderiaConRecargoArs],
      ['Lonas usadas', compra.lonasUsadas],
      ['Lonas cobradas', compra.lonasCobradas],
      ['Costo de lonas', compra.costoLonasArs],
      ['Bultos de envío', compra.bultosEnvio],
      ['Costo de envío', compra.costoEnvioArs],
      ...(compra.recargoFijoArs > 0 ? [['Recargo fijo', compra.recargoFijoArs]] : []),
      ...(compra.imprevistosArs > 0 ? [['Imprevistos', compra.imprevistosArs]] : []),
      ['Costo directo total de la compra', compra.costoDirectoTotalArs],
      [],
      ['Nota', 'Herramienta de simulación interna. No modifica productos, precios ni stock del catálogo.'],
    ]);
    wsResumen['!cols'] = [{ wch: 34 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen de la compra');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${slug}.xlsx"`,
      },
    });
  }

  // ── PDF ────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageW = PageSizes.A4[1]; // A4 apaisado — hay muchas columnas
  const pageH = PageSizes.A4[0];
  const margin = 30;
  const brand = rgb(0.29, 0.15, 0.68);
  const gray = rgb(0.45, 0.45, 0.45);
  const lightRow = rgb(0.96, 0.96, 0.98);
  const green = rgb(0.13, 0.5, 0.25);
  const red = rgb(0.7, 0.15, 0.15);
  const amber = rgb(0.7, 0.5, 0.05);

  const colX = { modelo: margin, docenas: 160, directoDoc: 210, costoReal: 280, precio: 350, ganancia: 420, margen: 490 };

  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const drawHeader = () => {
    page.drawText(compra.nombre, { x: margin, y, size: 16, font: fontBold, color: brand });
    y -= 18;
    const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(compra.fecha));
    page.drawText(`Compra multimodelo — ${fecha}`, { x: margin, y, size: 10, font, color: gray });
    y -= 16;
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 1, color: brand });
    y -= 16;
    page.drawText('Modelo', { x: colX.modelo, y, size: 8, font: fontBold, color: gray });
    page.drawText('Docenas', { x: colX.docenas, y, size: 8, font: fontBold, color: gray });
    page.drawText('Directo/doc', { x: colX.directoDoc, y, size: 8, font: fontBold, color: gray });
    page.drawText('Costo real/doc', { x: colX.costoReal, y, size: 8, font: fontBold, color: gray });
    page.drawText('Precio venta', { x: colX.precio, y, size: 8, font: fontBold, color: gray });
    page.drawText('Ganancia/doc', { x: colX.ganancia, y, size: 8, font: fontBold, color: gray });
    page.drawText('Margen', { x: colX.margen, y, size: 8, font: fontBold, color: gray });
    y -= 14;
  };

  const newPage = () => {
    page = pdfDoc.addPage([pageW, pageH]);
    y = pageH - margin;
    drawHeader();
  };

  drawHeader();

  for (const m of compra.modelos) {
    if (y - 16 < margin + 90) newPage();

    page.drawRectangle({ x: margin - 4, y: y - 3, width: pageW - margin * 2 + 8, height: 14, color: lightRow, opacity: 0.5 });
    const nombreTrunc = m.modelo.length > 26 ? m.modelo.slice(0, 23) + '…' : m.modelo;
    const colorVeredicto = m.veredicto === 'optimo' ? green : m.veredicto === 'perdida' ? red : m.veredicto === 'bajo_objetivo' ? amber : gray;

    page.drawText(nombreTrunc, { x: colX.modelo, y, size: 8, font, color: rgb(0, 0, 0) });
    page.drawText(String(m.docenas), { x: colX.docenas, y, size: 8, font, color: gray });
    page.drawText(formatPrice(m.directoDocena), { x: colX.directoDoc, y, size: 8, font, color: gray });
    page.drawText(m.costoRealDocena !== null ? formatPrice(m.costoRealDocena) : '—', { x: colX.costoReal, y, size: 8, font: fontBold, color: brand });
    page.drawText(m.precioVenta > 0 ? formatPrice(m.precioVenta) : '—', { x: colX.precio, y, size: 8, font, color: gray });
    page.drawText(m.gananciaDocena !== null ? formatPrice(m.gananciaDocena) : '—', { x: colX.ganancia, y, size: 8, font: fontBold, color: colorVeredicto });
    page.drawText(m.margenPct !== null ? `${m.margenPct.toFixed(1)}%` : '—', { x: colX.margen, y, size: 8, font, color: colorVeredicto });
    y -= 16;
  }

  if (y - 16 * 8 < margin) newPage();
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.5, color: gray });
  y -= 16;
  page.drawText('Resumen de la compra', { x: margin, y, size: 10, font: fontBold, color: brand });
  y -= 16;

  const resumen: [string, string][] = [
    ['Total de docenas', String(compra.docenasTotales)],
    ['Mercadería total', formatPrice(compra.mercaderiaTotalArs)],
    ...(compra.recargoPctArs > 0 ? [['Recargo sobre mercadería', formatPrice(compra.recargoPctArs)] as [string, string]] : []),
    ['Lonas usadas', `${compra.lonasUsadas} (cobradas: ${compra.lonasCobradas})`],
    ['Costo de lonas', formatPrice(compra.costoLonasArs)],
    ['Bultos de envío', String(compra.bultosEnvio)],
    ['Costo de envío', formatPrice(compra.costoEnvioArs)],
    ['Costo directo total de la compra', formatPrice(compra.costoDirectoTotalArs)],
  ];
  for (const [k, v] of resumen) {
    if (y - 14 < margin) newPage();
    page.drawText(k, { x: margin, y, size: 8, font, color: gray });
    page.drawText(v, { x: margin + 220, y, size: 8, font: fontBold, color: rgb(0, 0, 0) });
    y -= 14;
  }

  const totalPages = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((pg, i) => {
    const label = `Página ${i + 1} de ${totalPages}`;
    const w = font.widthOfTextAtSize(label, 8);
    pg.drawText(label, { x: pageW - margin - w, y: margin - 16, size: 8, font, color: gray });
    pg.drawText(
      'Documento de análisis interno — simulación de compra. No representa precios publicados en el catálogo.',
      { x: margin, y: margin - 16, size: 7, font, color: gray }
    );
  });

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug}.pdf"`,
    },
  });
}