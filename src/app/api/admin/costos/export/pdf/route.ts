import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import { formatPrice } from '@/utils';
import {
  calcularGastosFijosPorDocena,
  calcularCostoTotalDocena,
  simularMargen,
  MARGENES_DEFAULT,
} from '@/lib/costos';
import type { ProductCost, CostSetting, CostPeriodConfig } from '@/types';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return profile?.rol === 'admin' ? user : null;
}

function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * GET /api/admin/costos/export/pdf?periodo=YYYY-MM&margenes=30,50,100
 *
 * Exporta el reporte de Costos por Docena a PDF: mismo cálculo que la
 * tabla del admin y que el export a Excel (todo pasa por lib/costos.ts).
 * Es un documento de solo lectura para análisis interno — no modifica
 * el catálogo.
 */
export async function GET(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const periodo = req.nextUrl.searchParams.get('periodo') ?? periodoActual();
  const margenesParam = req.nextUrl.searchParams.get('margenes');
  const margenes = margenesParam
    ? margenesParam.split(',').map(Number).filter((n) => !Number.isNaN(n))
    : MARGENES_DEFAULT;

  const admin = createAdminClient();
  const [{ data: products, error }, { data: costs }, { data: settings }, { data: periodConfig }] =
    await Promise.all([
      admin.from('products').select('id, nombre, precio_docena').eq('activo', true).order('nombre'),
      admin.from('product_costs').select('*'),
      admin.from('cost_settings').select('*').eq('activo', true),
      admin.from('cost_period_config').select('*').eq('periodo', periodo).maybeSingle(),
    ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const costsByProduct = new Map<string, ProductCost>();
  for (const c of (costs ?? []) as ProductCost[]) costsByProduct.set(c.product_id, c);

  const totalGastosFijosMensuales = ((settings ?? []) as CostSetting[]).reduce(
    (acc, s) => acc + Number(s.monto_mensual), 0
  );
  const docenasEstimadas = (periodConfig as CostPeriodConfig | null)?.docenas_estimadas ?? 0;
  const gastosFijosPorDocena = calcularGastosFijosPorDocena(totalGastosFijosMensuales, docenasEstimadas);

  const rows = (products ?? []).map((p) => {
    const c = costsByProduct.get(p.id);
    const row = calcularCostoTotalDocena(
      {
        product_id: p.id,
        nombre: p.nombre,
        precio_docena_actual: Number(p.precio_docena),
        costo_compra_docena: Number(c?.costo_compra_docena ?? 0),
        transporte_docena: Number(c?.transporte_docena ?? 0),
        empaque_docena: Number(c?.empaque_docena ?? 0),
        otros_docena: Number(c?.otros_docena ?? 0),
      },
      gastosFijosPorDocena
    );
    return { row, simulaciones: margenes.map((m) => simularMargen(row.costo_total_docena, m)) };
  });

  const { data: settingsRow } = await admin
    .from('site_settings').select('valor').eq('clave', 'nombre_tienda').single();
  const nombreTienda = settingsRow?.valor ?? 'Mi Tienda';

  // ── Generar PDF (orientación horizontal — hay muchas columnas) ────────
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageW = PageSizes.A4[1]; // A4 apaisado
  const pageH = PageSizes.A4[0];
  const margin = 30;
  const brand = rgb(0.29, 0.15, 0.68);
  const gray = rgb(0.45, 0.45, 0.45);
  const lightRow = rgb(0.96, 0.96, 0.98);
  const green = rgb(0.13, 0.5, 0.25);

  // Columnas: Producto | Costo total/doc | precio actual | sugerido x margen...
  const colX = { producto: margin, costo: 220, actual: 300, margenes: 380 };
  const margenColWidth = (pageW - margin - colX.margenes) / margenes.length;

  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const drawHeader = () => {
    page.drawText(nombreTienda, { x: margin, y, size: 16, font: fontBold, color: brand });
    y -= 18;
    page.drawText(`Análisis de Costos por Docena — Período ${periodo}`, { x: margin, y, size: 10, font, color: gray });
    const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
    const fechaTxt = `Generado: ${fecha}`;
    const fechaWidth = font.widthOfTextAtSize(fechaTxt, 8);
    page.drawText(fechaTxt, { x: pageW - margin - fechaWidth, y: pageH - margin, size: 8, font, color: gray });
    y -= 14;
    page.drawText(
      `Gastos fijos prorrateados: ${formatPrice(gastosFijosPorDocena)} / docena  ·  Base: ${docenasEstimadas} docenas estimadas`,
      { x: margin, y, size: 8, font, color: gray }
    );
    y -= 16;
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 1, color: brand });
    y -= 16;
    page.drawText('Producto', { x: colX.producto, y, size: 8, font: fontBold, color: gray });
    page.drawText('Costo/Doc', { x: colX.costo, y, size: 8, font: fontBold, color: gray });
    page.drawText('Precio actual', { x: colX.actual, y, size: 8, font: fontBold, color: gray });
    margenes.forEach((m, i) => {
      page.drawText(`Sugerido ${m}%`, { x: colX.margenes + i * margenColWidth, y, size: 8, font: fontBold, color: gray });
    });
    y -= 14;
  };

  const newPage = () => {
    page = pdfDoc.addPage([pageW, pageH]);
    y = pageH - margin;
    drawHeader();
  };

  drawHeader();

  for (const { row, simulaciones } of rows) {
    if (y - 16 < margin + 30) newPage();

    page.drawRectangle({ x: margin - 4, y: y - 3, width: pageW - margin * 2 + 8, height: 14, color: lightRow, opacity: 0.5 });

    const nombreTrunc = row.nombre.length > 34 ? row.nombre.slice(0, 31) + '…' : row.nombre;
    page.drawText(nombreTrunc, { x: colX.producto, y, size: 8, font, color: rgb(0, 0, 0) });
    page.drawText(formatPrice(row.costo_total_docena), { x: colX.costo, y, size: 8, font: fontBold, color: brand });
    page.drawText(formatPrice(row.precio_docena_actual), { x: colX.actual, y, size: 8, font, color: gray });
    simulaciones.forEach((s, i) => {
      page.drawText(formatPrice(s.precio_sugerido_docena), {
        x: colX.margenes + i * margenColWidth, y, size: 8, font, color: green,
      });
    });
    y -= 16;
  }

  const totalPages = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((pg, i) => {
    const label = `Página ${i + 1} de ${totalPages}`;
    const w = font.widthOfTextAtSize(label, 8);
    pg.drawText(label, { x: pageW - margin - w, y: margin - 16, size: 8, font, color: gray });
    pg.drawText(
      'Documento de análisis interno — simulación de márgenes. No representa precios publicados en el catálogo.',
      { x: margin, y: margin - 16, size: 7, font, color: gray }
    );
  });

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="costos-por-docena-${periodo}.pdf"`,
    },
  });
}