import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import { formatPrice } from '@/utils';
import { rateLimiters } from '@/lib/rateLimit';

interface QuoteItem {
  nombre: string;
  tipoPack: 'media_docena' | 'docena' | 'unidad';
  cantidadPacks: number;
  precioUnitario: number;
  subtotal: number;
}

const PACK_LABEL: Record<QuoteItem['tipoPack'], string> = {
  media_docena: '½ docena',
  docena:       'Docena',
  unidad:       'Unidad',
};

/**
 * POST /api/orders/export-quote
 *
 * Genera un presupuesto formal en PDF a partir de los ítems ACTUALES del
 * carrito del cliente (no consulta la DB de pedidos — el carrito es
 * 100% local en el cliente, así que recibe los datos en el body). No crea
 * ningún pedido ni reserva stock — es solo un documento informativo para
 * que el comprador lo comparta o lo use como referencia antes de decidir.
 *
 * Body esperado:
 *   { items: QuoteItem[], costoEnvio?: number }
 */
export async function POST(req: NextRequest) {
  const limited = rateLimiters.upload(req); // reutiliza el mismo limiter conservador (5/10min)
  if (limited) return limited;

  try {
    const body = await req.json();
    const items: QuoteItem[] = Array.isArray(body?.items) ? body.items : [];
    const costoEnvio: number = typeof body?.costoEnvio === 'number' ? body.costoEnvio : 0;

    if (items.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 422 });
    }

    const admin = createAdminClient();
    const [{ data: bankInfo }, { data: nombreRow }] = await Promise.all([
      admin.from('bank_info').select('*').single(),
      admin.from('site_settings').select('valor').eq('clave', 'nombre_tienda').single(),
    ]);
    const nombreTienda = nombreRow?.valor ?? 'Mi Tienda';

    const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
    const total    = subtotal + costoEnvio;

    // ── Generar PDF ────────────────────────────────────────────────────
    const pdfDoc   = await PDFDocument.create();
    const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const [pageW, pageH] = PageSizes.A4;
    const margin = 50;
    const brand  = rgb(0.29, 0.15, 0.68);
    const gray   = rgb(0.45, 0.45, 0.45);
    const dark   = rgb(0.1, 0.1, 0.1);
    const lightRow = rgb(0.96, 0.96, 0.98);

    let page = pdfDoc.addPage(PageSizes.A4);
    let y = pageH - margin;

    // ── Membrete ──────────────────────────────────────────────────────
    page.drawText(nombreTienda, { x: margin, y, size: 22, font: fontBold, color: brand });
    y -= 26;
    page.drawText('Presupuesto de compra mayorista', { x: margin, y, size: 12, font, color: gray });

    const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
    const fechaLabel = `Emitido: ${fecha}`;
    const fechaWidth = font.widthOfTextAtSize(fechaLabel, 9);
    page.drawText(fechaLabel, { x: pageW - margin - fechaWidth, y: pageH - margin, size: 9, font, color: gray });

    y -= 20;
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 1.5, color: brand });
    y -= 30;

    // ── Encabezados de tabla ──────────────────────────────────────────
    page.drawText('Producto', { x: margin, y, size: 10, font: fontBold, color: gray });
    page.drawText('Pack', { x: 280, y, size: 10, font: fontBold, color: gray });
    page.drawText('Cant.', { x: 350, y, size: 10, font: fontBold, color: gray });
    page.drawText('Precio unit.', { x: 410, y, size: 10, font: fontBold, color: gray });
    page.drawText('Subtotal', { x: pageW - margin - 70, y, size: 10, font: fontBold, color: gray });
    y -= 8;
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.5, color: gray });
    y -= 18;

    const newPage = () => {
      page = pdfDoc.addPage(PageSizes.A4);
      y = pageH - margin;
    };

    for (const item of items) {
      if (y < margin + 100) newPage();

      page.drawRectangle({ x: margin - 4, y: y - 10, width: pageW - margin * 2 + 8, height: 20, color: lightRow, opacity: 0.5 });

      const nombreTrunc = item.nombre.length > 32 ? item.nombre.slice(0, 29) + '…' : item.nombre;
      page.drawText(nombreTrunc, { x: margin, y, size: 9.5, font, color: dark });
      page.drawText(PACK_LABEL[item.tipoPack] ?? item.tipoPack, { x: 280, y, size: 9.5, font, color: gray });
      page.drawText(String(item.cantidadPacks), { x: 350, y, size: 9.5, font, color: gray });
      page.drawText(formatPrice(item.precioUnitario), { x: 410, y, size: 9.5, font, color: gray });
      const subtotalTxt = formatPrice(item.subtotal);
      const subtotalW   = fontBold.widthOfTextAtSize(subtotalTxt, 9.5);
      page.drawText(subtotalTxt, { x: pageW - margin - subtotalW, y, size: 9.5, font: fontBold, color: dark });
      y -= 22;
    }

    // ── Totales ───────────────────────────────────────────────────────
    y -= 10;
    page.drawLine({ start: { x: 350, y }, end: { x: pageW - margin, y }, thickness: 0.5, color: gray });
    y -= 20;

    page.drawText('Subtotal', { x: 350, y, size: 10, font, color: gray });
    const subtotalTxt = formatPrice(subtotal);
    page.drawText(subtotalTxt, { x: pageW - margin - font.widthOfTextAtSize(subtotalTxt, 10), y, size: 10, font, color: dark });
    y -= 18;

    if (costoEnvio > 0) {
      page.drawText('Envío', { x: 350, y, size: 10, font, color: gray });
      const envioTxt = formatPrice(costoEnvio);
      page.drawText(envioTxt, { x: pageW - margin - font.widthOfTextAtSize(envioTxt, 10), y, size: 10, font, color: dark });
      y -= 18;
    }

    page.drawText('TOTAL', { x: 350, y, size: 13, font: fontBold, color: brand });
    const totalTxt = formatPrice(total);
    page.drawText(totalTxt, { x: pageW - margin - fontBold.widthOfTextAtSize(totalTxt, 13), y, size: 13, font: fontBold, color: brand });
    y -= 40;

    // ── Datos bancarios ───────────────────────────────────────────────
    if (bankInfo && (bankInfo.cbu || bankInfo.alias)) {
      if (y < margin + 140) newPage();
      page.drawRectangle({ x: margin - 4, y: y - 100, width: pageW - margin * 2 + 8, height: 108, color: lightRow, opacity: 0.6 });
      page.drawText('Datos para transferencia', { x: margin, y, size: 11, font: fontBold, color: brand });
      y -= 20;
      const bankLines = [
        bankInfo.titular    ? `Titular: ${bankInfo.titular}` : null,
        bankInfo.cbu         ? `CBU: ${bankInfo.cbu}` : null,
        bankInfo.alias       ? `Alias: ${bankInfo.alias}` : null,
        bankInfo.banco       ? `Banco: ${bankInfo.banco}` : null,
        bankInfo.cuit        ? `CUIT: ${bankInfo.cuit}` : null,
        bankInfo.tipo_cuenta ? `Tipo de cuenta: ${bankInfo.tipo_cuenta}` : null,
      ].filter(Boolean) as string[];
      for (const line of bankLines) {
        page.drawText(line, { x: margin, y, size: 9.5, font, color: dark });
        y -= 15;
      }
      y -= 10;
    }

    // ── Leyenda obligatoria ───────────────────────────────────────────
    if (y < margin + 60) newPage();
    page.drawRectangle({ x: margin - 4, y: y - 34, width: pageW - margin * 2 + 8, height: 40, color: rgb(0.99, 0.95, 0.85) });
    page.drawText('⚠ Presupuesto válido por 48 horas.', { x: margin, y: y - 8, size: 9.5, font: fontBold, color: rgb(0.6, 0.35, 0) });
    page.drawText('El stock no se reserva hasta acreditar el pago.', { x: margin, y: y - 24, size: 9.5, font, color: rgb(0.6, 0.35, 0) });

    // ── Footer de página ──────────────────────────────────────────────
    const totalPages = pdfDoc.getPageCount();
    pdfDoc.getPages().forEach((pg, i) => {
      const label = `Página ${i + 1} de ${totalPages}`;
      const w = font.widthOfTextAtSize(label, 8);
      pg.drawText(label, { x: pageW - margin - w, y: margin - 20, size: 8, font, color: gray });
      pg.drawText(nombreTienda, { x: margin, y: margin - 20, size: 8, font, color: gray });
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="presupuesto-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (err: unknown) {
    console.error('Export quote error:', err);
    return NextResponse.json({ error: 'No se pudo generar el presupuesto' }, { status: 500 });
  }
}
