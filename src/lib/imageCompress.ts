/**
 * Reduce una foto antes de subirla (solo navegador). Se usa cuando el admin elige
 * "Subir sin editar": el editor de imágenes ya reduce a 1600 px, pero ese botón
 * mandaba el archivo original del celular (4–8 MB), que después Vercel tenía que
 * procesar la primera vez que alguien lo veía.
 *
 * Reglas, siempre del lado seguro:
 *  - GIF y SVG no se tocan (animación / vectores).
 *  - Si no se puede leer la imagen (por ejemplo HEIC en Chrome) o algo falla, se
 *    devuelve el archivo ORIGINAL: subir sin reducir es mejor que no subir.
 *  - Si el resultado no queda más liviano, también se devuelve el original.
 *  - Salida en JPEG (igual que el editor): WebP desde canvas no es confiable en Safari.
 */
export async function reducirImagen(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  try {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));

    // Ya es chica y liviana: no vale la pena recomprimirla.
    if (scale === 1 && file.type === 'image/jpeg' && file.size < 400_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width  = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return file; }

    ctx.fillStyle = '#ffffff'; // PNG con transparencia: sin esto quedaría negro en el JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob && blob.type === 'image/jpeg' && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}