import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import { formatPrice } from '@/utils';
import type { PriceTier } from '@/types';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return profile?.rol === 'admin' ? user : null;
}

interface RowProduct {
  nombre: string;
  precio_media_docena: number | null;
  precio_docena: number;
  precio_tiers: PriceTier[];
  stock_unidades: number;
  colores: string[];
  talles: string[];
}

/**
 * GET /api/admin/price-list?categoria=<slug opcional>
 *
 * Genera la lista de precios mayorista en PDF: nombre, precio docena
 * (con escalones por volumen si tiene), precio media docena (si aplica),
 * talles/colores disponibles y stock. Solo productos activos y
 * venta_mayorista=true — es exactamente lo que se le manda a un cliente
 * mayorista que pide "la lista".
 */
export async function GET(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const soloConStock  = req.nextUrl.searchParams.get('solo_con_stock') === 'true';

  const admin = createAdminClient();
  let query = admin
    .from('products')
    .select('nombre, precio_media_docena, precio_docena, precio_tiers, stock_unidades, colores, talles')
    .eq('activo', true)
    .eq('venta_mayorista', true)
    .order('nombre', { ascending: true });

  if (soloConStock) query = query.gt('stock_unidades', 0);

  const { data: products, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filtered = (products ?? []) as unknown as RowProduct[];

  const { data: settingsRow } = await admin
    .from('site_settings')
    .select('valor')
    .eq('clave', 'nombre_tienda')
    .single();
  const nombreTienda = settingsRow?.valor ?? 'Mi Tienda';

  // ── Generar PDF ──────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const font       = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const [pageW, pageH] = PageSizes.A4;
  const margin = 40;
  const brand  = rgb(0.29, 0.15, 0.68); // morado marca, ajustable
  const gray   = rgb(0.45, 0.45, 0.45);
  const lightRow = rgb(0.96, 0.96, 0.98);

  let page = pdfDoc.addPage(PageSizes.A4);
  let y = pageH - margin;

  const newPage = () => {
    page = pdfDoc.addPage(PageSizes.A4);
    y = pageH - margin;
    drawHeader();
  };

  const drawHeader = () => {
    page.drawText(nombreTienda, { x: margin, y, size: 18, font: fontBold, color: brand });
    y -= 22;
    page.drawText('Lista de precios mayorista', { x: margin, y, size: 11, font, color: gray });
    const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
    const fechaWidth = font.widthOfTextAtSize(`Actualizado: ${fecha}`, 9);
    page.drawText(`Actualizado: ${fecha}`, { x: pageW - margin - fechaWidth, y: pageH - margin, size: 9, font, color: gray });
    y -= 20;
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 1, color: brand });
    y -= 20;
    // Encabezados de columna
    page.drawText('Producto', { x: margin, y, size: 9, font: fontBold, color: gray });
    page.drawText('½ Docena', { x: 300, y, size: 9, font: fontBold, color: gray });
    page.drawText('Docena', { x: 370, y, size: 9, font: fontBold, color: gray });
    page.drawText('Stock', { x: 440, y, size: 9, font: fontBold, color: gray });
    page.drawText('Talles/Colores', { x: 480, y, size: 9, font: fontBold, color: gray });
    y -= 14;
  };

  drawHeader();

  for (const p of filtered) {
    const rowLines = 1 + (p.precio_tiers?.length > 0 ? 1 : 0);
    const rowHeight = 14 * rowLines + 6;
    if (y - rowHeight < margin + 30) newPage();

    // Fondo alternado leve para legibilidad
    page.drawRectangle({ x: margin - 4, y: y - 11, width: pageW - margin * 2 + 8, height: rowHeight, color: lightRow, opacity: 0.5 });

    const nombreTrunc = p.nombre.length > 38 ? p.nombre.slice(0, 35) + '…' : p.nombre;
    page.drawText(nombreTrunc, { x: margin, y, size: 9, font, color: rgb(0, 0, 0) });
    page.drawText(p.precio_media_docena != null ? formatPrice(p.precio_media_docena) : '—', { x: 300, y, size: 9, font, color: rgb(0, 0, 0) });
    page.drawText(formatPrice(p.precio_docena), { x: 370, y, size: 9, font: fontBold, color: brand });
    page.drawText(p.stock_unidades > 0 ? `${p.stock_unidades} u.` : 'Sin stock', {
      x: 440, y, size: 9, font, color: p.stock_unidades > 0 ? gray : rgb(0.8, 0.2, 0.2),
    });
    const talycol = [...(p.talles ?? []), ...(p.colores ?? [])].slice(0, 4).join(', ') || '—';
    const talycolTrunc = talycol.length > 28 ? talycol.slice(0, 25) + '…' : talycol;
    page.drawText(talycolTrunc, { x: 480, y, size: 8, font, color: gray });
    y -= 14;

    // Segunda línea: escalones de precio por volumen, si tiene
    if (p.precio_tiers?.length > 0) {
      const tiersTxt = [...p.precio_tiers]
        .sort((a, b) => a.min_docenas - b.min_docenas)
        .map((t) => `${t.min_docenas}+ doc: ${formatPrice(t.precio_docena)} c/u`)
        .join('   •   ');
      page.drawText(`   ↳ ${tiersTxt}`, { x: margin, y, size: 7.5, font, color: brand });
      y -= 14;
    }
    y -= 4;
  }

  // Footer de página
  const totalPages = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((pg, i) => {
    const label = `Página ${i + 1} de ${totalPages}`;
    const w = font.widthOfTextAtSize(label, 8);
    pg.drawText(label, { x: pageW - margin - w, y: margin - 20, size: 8, font, color: gray });
    pg.drawText('Precios sujetos a modificación sin previo aviso. Venta exclusivamente mayorista.', {
      x: margin, y: margin - 20, size: 7.5, font, color: gray,
    });
  });

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="lista-precios-mayorista-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
