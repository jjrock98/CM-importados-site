'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Plus, Pencil, Trash2, X, Upload, Package, Search, Video, Copy, TrendingDown, FileDown } from 'lucide-react';
import { ProductVariantsManager } from './ProductVariantsManager';
import { createClient } from '@/lib/supabase/client';
import { slugify, formatPrice } from '@/utils';
import { CATEGORIAS, categoriaLabel } from '@/lib/categorias';
import type { Product, PriceTier } from '@/types';
import toast from 'react-hot-toast';

const EMPTY: Omit<Product, 'id' | 'created_at' | 'updated_at'> = {
  nombre: '', slug: '', descripcion: '', descripcion_corta: '',
  imagenes: [], videos: [], stock_unidades: 0,
  // Media docena queda opcional (null): hay productos que solo se venden
  // por docena completa o por curva/pack surtido.
  precio_media_docena: null, precio_docena: 0,
  venta_minorista: false, venta_mayorista: true, precio_unitario: null as null | number,
  stock_minorista_min: 1, stock_minorista_max: 12,
  colores: [], talles: [], categoria: 'otro', activo: true, destacado: false,
  precio_tiers: [],
};

export function AdminProductsClient({ initialProducts, initialLowStockFilter }: { initialProducts: Product[]; initialLowStockFilter?: boolean }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [editing, setEditing]   = useState<Partial<Product> | null>(null);
  const [isNew, setIsNew]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  // ✅ FIX: el widget "Stock bajo" del dashboard linkea acá con
  // ?filter=lowstock pero nunca se leía — quedaba muerto. Mismo umbral
  // que usa el dashboard para contar (< 12 unidades).
  const [soloStockBajo, setSoloStockBajo] = useState(!!initialLowStockFilter);

  const filtered = products
    .filter((p) => p.nombre.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => !soloStockBajo || p.stock_unidades < 12);

  const openNew = () => { setEditing({ ...EMPTY }); setIsNew(true); };
  const openEdit = (p: Product) => { setEditing({ ...p }); setIsNew(false); };

  /**
   * Duplica un producto como su versión del otro canal (mayorista ↔ minorista)
   * — copia nombre, descripción, imágenes, colores/talles y variantes con su
   * stock, generando un slug nuevo. El admin solo tiene que ajustar precios
   * y, si quiere, el stock de las variantes copiadas (quedan editables).
   */
  const duplicateAsChannel = async (p: Product) => {
    const toMayorista = p.venta_mayorista && !p.venta_minorista; // origen es mayorista → duplicar a minorista
    const sufijo = toMayorista ? ' — Individual' : ' — Docena Surtida';
    const nombreNuevo = p.nombre.replace(/ — (Individual|Docena Surtida)$/, '') + sufijo;
    const slugNuevo = `${slugify(nombreNuevo)}-${Date.now().toString(36)}`;

    try {
      // 1. Crear el producto nuevo
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreNuevo,
          slug: slugNuevo,
          descripcion: p.descripcion,
          descripcion_corta: p.descripcion_corta,
          imagenes: p.imagenes,
          videos: p.videos,
          colores: p.colores,
          talles: p.talles,
          categoria: p.categoria,
          stock_unidades: 0,
          precio_media_docena: p.precio_media_docena,
          precio_docena: p.precio_docena,
          precio_tiers: p.precio_tiers,
          precio_unitario: p.precio_unitario,
          stock_minorista_min: p.stock_minorista_min,
          stock_minorista_max: p.stock_minorista_max,
          venta_mayorista: !toMayorista ? true : false,
          venta_minorista: toMayorista ? true : false,
          activo: false, // arranca inactivo para que lo revises antes de publicar
          destacado: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? 'Error al duplicar'); return; }
      const nuevoId = json.data.id as string;

      // 2. Copiar variantes (talla/color) con el mismo stock, ahora independientes
      const variantsRes = await fetch(`/api/admin/products/${p.id}/variants`);
      const variantsJson = await variantsRes.json();
      const variantesOrigen = (variantsJson.data ?? []) as { talla: string; color: string; stock_unidades: number }[];

      for (const v of variantesOrigen) {
        await fetch(`/api/admin/products/${nuevoId}/variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ talla: v.talla, color: v.color, stock_unidades: v.stock_unidades }),
        });
      }

      toast.success(
        variantesOrigen.length > 0
          ? `Producto duplicado con ${variantesOrigen.length} variantes copiadas — quedó inactivo, revisalo antes de publicar`
          : 'Producto duplicado — quedó inactivo, revisalo antes de publicar'
      );
      setProducts((prev) => [json.data as Product, ...prev]);
    } catch {
      toast.error('Error al duplicar el producto');
    }
  };

  /**
   * Genera texto de surtido para "Descripción corta".
   * — Productos minorista (venta_minorista=true): lee la tabla de variantes
   *   real (talla/color/stock) y agrupa talles por color, porque ahí cada
   *   combinación tiene su propio stock independiente.
   * — Productos mayorista (por docena/curva): NO usan esa tabla de
   *   variantes — talles y colores son los campos simples del formulario
   *   ("guía orientativa" de lo que trae la docena/curva, sin stock por
   *   combinación). Antes el botón solo miraba la tabla de variantes y
   *   tiraba error acá aunque el producto sí tuviera talles/colores
   *   cargados. Ahora, si es mayorista, arma el texto desde esos campos.
   */
  const generarDescripcionSurtido = async () => {
    if (!editing?.id) { toast.error('Guardá el producto primero'); return; }

    if (!editing.venta_minorista) {
      const colores = editing.colores ?? [];
      const talles  = editing.talles ?? [];
      if (colores.length === 0 && talles.length === 0) {
        toast.error('Cargá colores y/o talles para poder generar la descripción');
        return;
      }
      const partes: string[] = [];
      if (colores.length) partes.push(`colores ${colores.join(', ')}`);
      if (talles.length)  partes.push(`talles ${talles.join(', ')}`);
      const texto = 'Incluye ' + partes.join(' y ') + '.';
      setEditing((prev) => ({ ...prev, descripcion_corta: texto }));
      toast.success('Descripción generada desde colores/talles cargados');
      return;
    }

    const res  = await fetch(`/api/admin/products/${editing.id}/variants`);
    const json = await res.json();
    const variantes = (json.data ?? []) as { talla: string; color: string; stock_unidades: number }[];
    const activas = variantes.filter((v) => v.stock_unidades > 0);

    if (activas.length === 0) {
      toast.error('Este producto no tiene variantes con stock cargadas');
      return;
    }

    // Agrupar por color, listando los talles disponibles de cada uno
    const porColor = new Map<string, string[]>();
    for (const v of activas) {
      const talles = porColor.get(v.color) ?? [];
      talles.push(v.talla);
      porColor.set(v.color, talles);
    }
    const texto = 'Incluye: ' + [...porColor.entries()]
      .map(([color, talles]) => `${color} (${talles.join(', ')})`)
      .join(' · ');

    setEditing((prev) => ({ ...prev, descripcion_corta: texto }));
    toast.success('Descripción generada desde el stock real');
  };
  const close = () => { setEditing(null); setIsNew(false); };

  const setField = (k: keyof Product) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.type === 'number' ? Number(e.target.value) :
                e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setEditing((prev) => {
      const updated = { ...prev!, [k]: val };
      if (k === 'nombre' && isNew) updated.slug = slugify(String(val));
      return updated;
    });
  };

  const setArrayField = (k: 'colores' | 'talles', val: string) => {
    setEditing((prev) => ({ ...prev!, [k]: val.split(',').map((s) => s.trim()).filter(Boolean) }));
  };

  const uploadImages = async (files: FileList) => {
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      // ✅ Antes solo se reemplazaban espacios por guiones. Nombres de
      // archivo con paréntesis, acentos, apóstrofes, etc. (típico de
      // fotos sacadas con el celular, ej. "IMG_2024 (3).jpg") quedaban
      // con esos caracteres literales en la URL pública. Eso no rompe el
      // <img src=...> normal, pero SÍ rompe el `background-image:
      // url(...)` que usa la lupa de zoom (el paréntesis cierra el token
      // url() antes de tiempo) — el resultado es un panel de zoom
      // completamente negro, sin la imagen. Ahora se sanitiza todo el
      // nombre: se sacan los acentos y se reemplaza cualquier caracter
      // que no sea letra/número/punto/guion por "-".
      const cleanName = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca acentos (á→a, ñ→n, etc.)
        .replace(/[^a-zA-Z0-9.-]+/g, '-')                  // cualquier otro caracter → "-"
        .replace(/-+/g, '-');                              // colapsa guiones repetidos
      const path = `${Date.now()}-${cleanName}`;
      const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
        urls.push(publicUrl);
      }
    }
    setEditing((prev) => ({ ...prev!, imagenes: [...(prev?.imagenes ?? []), ...urls] }));
    setUploading(false);
    toast.success(`${urls.length} imagen${urls.length !== 1 ? 'es' : ''} subida${urls.length !== 1 ? 's' : ''}`);
  };

  const removeImage = (url: string) => {
    setEditing((prev) => ({ ...prev!, imagenes: prev!.imagenes!.filter((i) => i !== url) }));
  };

  const [videoInput, setVideoInput] = useState('');
  const addVideo = () => {
    const url = videoInput.trim();
    if (!url) return;
    if (!/^https?:\/\//.test(url)) { toast.error('Ingresá una URL válida (http/https)'); return; }
    setEditing((prev) => ({ ...prev!, videos: [...(prev?.videos ?? []), url] }));
    setVideoInput('');
  };
  const removeVideo = (url: string) => {
    setEditing((prev) => ({ ...prev!, videos: (prev?.videos ?? []).filter((v) => v !== url) }));
  };

  const handleSave = async () => {
    if (!editing?.nombre || !editing.slug) { toast.error('Nombre y slug son requeridos'); return; }
    setSaving(true);
    try {
      const payload = {
        nombre:              editing.nombre,
        slug:                editing.slug,
        descripcion:         editing.descripcion   || null,
        descripcion_corta:   editing.descripcion_corta || null,
        imagenes:            editing.imagenes       ?? [],
        videos:              editing.videos         ?? [],
        stock_unidades:      Number(editing.stock_unidades ?? 0),
        // Media docena es opcional: si el campo quedó vacío/0, el producto
        // solo se vende por docena completa (o por curva/pack surtido).
        precio_media_docena: editing.precio_media_docena ? Number(editing.precio_media_docena) : null,
        precio_docena:         Number(editing.precio_docena ?? 0),
        precio_tiers:          editing.precio_tiers ?? [],
        // Canal minorista desactivado (venta solo mayorista). Se conservan
        // estos campos en la DB por si se reactiva en el futuro, pero el
        // formulario ya no los ofrece.
        venta_minorista:       false,
        venta_mayorista:       true,
        precio_unitario:       editing.precio_unitario ? Number(editing.precio_unitario) : null,
        stock_minorista_min:   Number(editing.stock_minorista_min ?? 1),
        stock_minorista_max:   Number(editing.stock_minorista_max ?? 12),
        colores:             editing.colores        ?? [],
        talles:              editing.talles         ?? [],
        categoria:           editing.categoria      || 'otro',
        activo:              editing.activo         ?? true,
        destacado:           editing.destacado      ?? false,
      };

      if (isNew) {
        const res = await fetch('/api/admin/products', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const { data, error } = await res.json();
        if (error) throw new Error(error);
        setProducts((prev) => [data, ...prev]);
        toast.success('Producto creado');
      } else {
        const res = await fetch(`/api/admin/products/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const { data, error } = await res.json();
        if (error) throw new Error(error);
        setProducts((prev) => prev.map((p) => p.id === editing.id ? data : p));
        toast.success('Producto actualizado');
      }
      close();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
    const res  = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    toast.success('Producto eliminado');
  };

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const handleDownloadPriceList = async () => {
    setDownloadingPdf(true);
    try {
      const res = await fetch('/api/admin/price-list');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'No se pudo generar el PDF');
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `lista-precios-mayorista-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al descargar el PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar productos…" className="input-base pl-9 py-2 text-sm" />
        </div>
        <button onClick={handleDownloadPriceList} disabled={downloadingPdf} className="btn-ghost gap-2 text-sm border border-border">
          <FileDown size={16} /> {downloadingPdf ? 'Generando…' : 'Lista de precios (PDF)'}
        </button>
        <button onClick={openNew} className="btn-primary gap-2 text-sm">
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      {/* ✅ FIX: filtro de stock bajo, ahora sí conectado con el link del dashboard */}
      {soloStockBajo && (
        <button onClick={() => setSoloStockBajo(false)}
          className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-400 px-3 py-1.5 text-xs font-medium">
          ⚠️ Mostrando solo stock bajo (&lt;12 uds) <X size={12} />
        </button>
      )}

      {/* Products table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-2">
              <tr className="text-left text-xs text-muted">
                <th className="p-3">Producto</th>
                <th className="p-3">Stock</th>
                <th className="p-3">½ Docena</th>
                <th className="p-3">Docena</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-surface-2 shrink-0">
                        {p.imagenes[0]
                          ? <Image src={p.imagenes[0]} alt={p.nombre} fill className="object-cover" sizes="40px" />
                          : <Package size={16} className="m-auto text-muted absolute inset-0" />}
                      </div>
                      <div>
                        <p className="font-medium line-clamp-1 flex items-center gap-1.5">
                          {p.nombre}
                          {!p.venta_mayorista && (
                            <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-[10px] shrink-0">
                              Solo minorista
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted">{p.slug} · {categoriaLabel(p.categoria)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`font-semibold ${p.stock_unidades < 12 ? 'text-red-500' : p.stock_unidades < 30 ? 'text-yellow-500' : 'text-green-600'}`}>
                      {p.stock_unidades}
                    </span>
                  </td>
                  <td className="p-3 text-brand-600 font-medium">{p.precio_media_docena != null ? formatPrice(p.precio_media_docena) : <span className="text-muted text-xs">— (no ofrece)</span>}</td>
                  <td className="p-3 text-brand-600 font-medium">{formatPrice(p.precio_docena)}</td>
                  <td className="p-3">
                    <span className={`badge ${p.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {p.destacado && <span className="badge bg-brand-100 text-brand-700 ml-1">Destacado</span>}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="btn-ghost p-1.5 text-muted hover:text-brand-600">
                        <Pencil size={14} />
                      </button>
                      {/* Duplicar por canal (mayorista↔minorista) desactivado junto con el
                          canal minorista. La función duplicateAsChannel queda en el código
                          por si se reactiva ese canal más adelante. */}
                      <button onClick={() => handleDelete(p.id)} className="btn-ghost p-1.5 text-muted hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="py-12 text-center text-sm text-muted">No hay productos.</p>
          )}
        </div>
      </div>

      {/* Edit/Create modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-semibold">{isNew ? 'Nuevo producto' : 'Editar producto'}</h2>
              <button onClick={close} className="btn-ghost p-1.5"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Images */}
              <div>
                <p className="text-xs font-medium mb-2">Imágenes</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(editing.imagenes ?? []).map((url) => (
                    <div key={url} className="relative h-16 w-16">
                      <Image src={url} alt="" fill className="rounded-lg object-cover" sizes="64px" />
                      <button onClick={() => removeImage(url)}
                        className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-brand-400 transition-colors">
                    <input type="file" multiple accept="image/*" className="hidden"
                      onChange={(e) => e.target.files && uploadImages(e.target.files)} />
                    {uploading ? <span className="text-xs text-muted">...</span> : <Upload size={16} className="text-muted" />}
                  </label>
                </div>
              </div>

              {/* Videos */}
              <div>
                <p className="text-xs font-medium mb-2">Videos (URL de YouTube, Vimeo o .mp4 directo)</p>
                <div className="space-y-1.5 mb-2">
                  {(editing.videos ?? []).map((url) => (
                    <div key={url} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                      <Video size={13} className="text-muted shrink-0" />
                      <span className="text-xs truncate flex-1">{url}</span>
                      <button onClick={() => removeVideo(url)} className="text-muted hover:text-red-500 shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={videoInput}
                    onChange={(e) => setVideoInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVideo())}
                    placeholder="https://youtube.com/watch?v=..."
                    className="input-base text-xs flex-1"
                  />
                  <button onClick={addVideo} className="btn-secondary text-xs px-3">Agregar</button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Nombre *</label>
                  <input value={editing.nombre ?? ''} onChange={setField('nombre')} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Slug</label>
                  <input value={editing.slug ?? ''} onChange={setField('slug')} className="input-base font-mono text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Categoría</label>
                <select value={editing.categoria ?? 'otro'} onChange={setField('categoria')} className="input-base">
                  {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium">Descripción corta</label>
                  {editing.id && (
                    <button
                      onClick={generarDescripcionSurtido}
                      type="button"
                      className="text-[10px] text-brand-600 hover:underline flex items-center gap-1"
                      title="Mayorista: arma el texto desde Colores/Talles cargados. Minorista: lee el stock real por variante."
                    >
                      ✨ Generar desde stock real
                    </button>
                  )}
                </div>
                <input value={editing.descripcion_corta ?? ''} onChange={setField('descripcion_corta')} className="input-base" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Descripción completa</label>
                <textarea value={editing.descripcion ?? ''} onChange={setField('descripcion')}
                  rows={3} className="input-base resize-none" />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Stock (unidades)</label>
                  <input type="number" min="0" value={editing.stock_unidades ?? 0} onChange={setField('stock_unidades')} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Precio ½ docena <span className="text-muted font-normal">(opcional)</span>
                  </label>
                  <input type="number" min="0" step="0.01" value={editing.precio_media_docena ?? ''}
                    onChange={setField('precio_media_docena')} placeholder="Dejar vacío si no se vende por ½ docena"
                    className="input-base" />
                  <p className="text-[10px] text-muted mt-1">
                    Vacío = este producto solo se vende por docena completa o por curva/pack surtido.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Precio docena</label>
                  <input type="number" min="0" step="0.01" value={editing.precio_docena ?? 0} onChange={setField('precio_docena')} className="input-base" />
                </div>

                {/* ── Precio escalonado por volumen (quiebre de precio) ── */}
                <div className="col-span-full rounded-xl border border-border bg-surface-2 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown size={16} className="text-brand-600" />
                    <p className="text-sm font-semibold">Precio por volumen (opcional)</p>
                  </div>
                  <p className="text-xs text-muted mb-3">
                    Definí escalones de descuento por cantidad de docenas. Ej: comprando 5 docenas o más, precio más bajo por docena.
                  </p>
                  <div className="space-y-2">
                    {(editing.precio_tiers ?? []).map((tier, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-muted w-10">Desde</span>
                        <input
                          type="number" min="1" placeholder="Docenas"
                          value={tier.min_docenas}
                          onChange={(e) => {
                            const tiers = [...(editing.precio_tiers ?? [])];
                            tiers[idx] = { ...tiers[idx], min_docenas: Number(e.target.value) };
                            setEditing((prev) => ({ ...prev, precio_tiers: tiers }));
                          }}
                          className="input-base w-24"
                        />
                        <span className="text-xs text-muted">docenas →</span>
                        <input
                          type="number" min="0" step="0.01" placeholder="Precio c/u"
                          value={tier.precio_docena}
                          onChange={(e) => {
                            const tiers = [...(editing.precio_tiers ?? [])];
                            tiers[idx] = { ...tiers[idx], precio_docena: Number(e.target.value) };
                            setEditing((prev) => ({ ...prev, precio_tiers: tiers }));
                          }}
                          className="input-base flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const tiers = (editing.precio_tiers ?? []).filter((_, i) => i !== idx);
                            setEditing((prev) => ({ ...prev, precio_tiers: tiers }));
                          }}
                          className="btn-ghost p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const tiers: PriceTier[] = [...(editing.precio_tiers ?? []), { min_docenas: 5, precio_docena: Number(editing.precio_docena ?? 0) }];
                        setEditing((prev) => ({ ...prev, precio_tiers: tiers }));
                      }}
                      className="btn-ghost text-xs text-brand-600"
                    >
                      <Plus size={14} /> Agregar escalón
                    </button>
                  </div>
                  {(editing.precio_tiers?.length ?? 0) > 0 && (
                    <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-2 py-1.5 mt-2">
                      ⚠️ Cada escalón debe tener menos docenas mínimas que el siguiente. El sistema aplica automáticamente el escalón más alto alcanzado por la cantidad comprada.
                    </p>
                  )}
                </div>

                {/*
                  Canal minorista (venta por unidad individual) desactivado por
                  decisión de negocio: todo se vende mayorista, por docena
                  (obligatoria) y ½ docena (opcional) o por curva/pack surtido.
                  Se dejan venta_mayorista=true / venta_minorista=false fijos
                  en el submit. Los controles de este canal (toggle mayorista/
                  minorista, precio por unidad, mínimos/máximos) se quitaron
                  del formulario pero la lógica sigue en el código y los datos
                  siguen en la DB por si se reactiva en el futuro.
                */}

                {/* ── Variantes talla/color — solo si el producto ya existe ── */}
                {editing.venta_minorista && editing.id && (
                  <ProductVariantsManager productId={editing.id} />
                )}
                {editing.venta_minorista && !editing.id && (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2">
                    Guardá el producto primero para poder agregar variantes de talla/color.
                  </p>
                )}
                <div style={{display:'none'}}>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Colores (separados por coma)</label>
                  <input value={(editing.colores ?? []).join(', ')} onChange={(e) => setArrayField('colores', e.target.value)} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Talles (separados por coma)</label>
                  <input value={(editing.talles ?? []).join(', ')} onChange={(e) => setArrayField('talles', e.target.value)} className="input-base" />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editing.activo ?? true}
                    onChange={(e) => setEditing((p) => ({ ...p!, activo: e.target.checked }))}
                    className="accent-brand-500 h-4 w-4" />
                  Activo
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editing.destacado ?? false}
                    onChange={(e) => setEditing((p) => ({ ...p!, destacado: e.target.checked }))}
                    className="accent-brand-500 h-4 w-4" />
                  Destacado en inicio
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button onClick={close} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Guardando…' : isNew ? 'Crear producto' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}