'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { RotateCw, X, ZoomIn } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Editor de imágenes del panel de admin: ver en grande (con zoom), recortar
 * (libre o con proporción fija) y rotar.
 *
 * Se usa en dos situaciones:
 *  - mode="new":      el admin acaba de elegir un archivo de su galería, todavía
 *                     NO se subió. Puede subirlo tal cual, o recortarlo/rotarlo.
 *  - mode="existing": la imagen ya está subida al producto. "Guardar" genera una
 *                     imagen nueva que la reemplaza (el que lo usa se encarga de
 *                     borrar la vieja del storage).
 *
 * El resultado siempre sale como JPEG, con un máximo de 1600 px de lado: pesa
 * mucho menos que una foto de celular y alcanza de sobra para el catálogo.
 */

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.88;

type AspectKey = 'libre' | '1:1' | '4:5' | '3:4';
const ASPECTS: { key: AspectKey; label: string; value: number | undefined }[] = [
  { key: 'libre', label: 'Libre', value: undefined },
  { key: '1:1',   label: '1:1',   value: 1 },
  { key: '4:5',   label: '4:5',   value: 4 / 5 },
  { key: '3:4',   label: '3:4',   value: 3 / 4 },
];

interface Props {
  /** Archivo recién elegido, o URL de una imagen ya subida. */
  source: Blob | string;
  mode: 'new' | 'existing';
  /** Nombre del archivo, solo para mostrar. */
  title?: string;
  onCancel: () => void;
  /**
   * `null` = el admin eligió subir el archivo original sin tocarlo (solo mode="new").
   * `Blob` = imagen editada (recortada y/o rotada), lista para subir.
   */
  onConfirm: (result: Blob | null) => void;
  /** Deshabilita los botones mientras el padre está subiendo. */
  busy?: boolean;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

export function ImageEditorModal({ source, mode, title, onCancel, onConfirm, busy = false }: Props) {
  // URL "de trabajo" (object URL) sobre la que se muestra y recorta. Cambia al rotar.
  const [workUrl, setWorkUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [zoom, setZoom] = useState(100);          // % del ancho del visor
  const [aspect, setAspect] = useState<AspectKey>('libre');
  const [crop, setCrop] = useState<PercentCrop | undefined>(undefined);
  const [working, setWorking] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Todas las object URLs creadas, para liberarlas al cerrar.
  const createdUrls = useRef<string[]>([]);
  const track = useCallback((blob: Blob) => {
    const u = URL.createObjectURL(blob);
    createdUrls.current.push(u);
    return u;
  }, []);

  // Carga inicial: si es una URL remota se baja como blob (así el canvas no
  // queda "contaminado" por CORS y se puede recortar sin errores).
  useEffect(() => {
    let cancelled = false;
    const urls = createdUrls.current;
    (async () => {
      try {
        let blob: Blob;
        if (typeof source === 'string') {
          const res = await fetch(source, { mode: 'cors', cache: 'no-store' });
          if (!res.ok) throw new Error('fetch');
          blob = await res.blob();
        } else {
          blob = source;
        }
        if (!cancelled) setWorkUrl(track(blob));
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.length = 0;
    };
  }, [source, track]);

  const hasCrop = !!crop && crop.width > 0.5 && crop.height > 0.5;
  const hasChanges = hasCrop || rotated;

  const selectAspect = (key: AspectKey) => {
    setAspect(key);
    const img = imgRef.current;
    if (!img) return;
    const value = ASPECTS.find((a) => a.key === key)?.value;
    if (value === undefined) {
      // Libre: no se toca la selección actual; si no había, se arranca con el 90%.
      if (!crop) setCrop({ unit: '%', x: 5, y: 5, width: 90, height: 90 });
      return;
    }
    setCrop(
      centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, value, img.width, img.height),
        img.width,
        img.height,
      ),
    );
  };

  const rotate = async () => {
    if (!workUrl || working) return;
    setWorking(true);
    try {
      const img = await loadImage(workUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const blob = await canvasToBlob(canvas);
      setWorkUrl(track(blob));
      setRotated(true);
      setCrop(undefined); // la selección anterior ya no corresponde a la imagen girada
    } catch {
      toast.error('No se pudo rotar la imagen');
    } finally {
      setWorking(false);
    }
  };

  const confirm = async () => {
    const img = imgRef.current;
    if (!img || !hasChanges || working) return;
    setWorking(true);
    try {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      // Sin recorte (solo se rotó): se toma la imagen completa.
      const c = hasCrop ? crop! : { x: 0, y: 0, width: 100, height: 100 };
      const sx = (c.x / 100) * nw;
      const sy = (c.y / 100) * nh;
      const sw = (c.width / 100) * nw;
      const sh = (c.height / 100) * nh;
      const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      // Fondo blanco: si la imagen tiene transparencia (PNG) no queda negra en el JPEG.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      onConfirm(await canvasToBlob(canvas));
    } catch {
      toast.error('No se pudo generar la imagen editada');
    } finally {
      setWorking(false);
    }
  };

  const disabled = busy || working;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Editor de imagen"
    >
      <div className="flex max-h-[96vh] w-full max-w-3xl flex-col rounded-2xl bg-surface shadow-2xl">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">
              {mode === 'new' ? 'Nueva imagen' : 'Editar imagen'}
            </h3>
            {title && <p className="truncate text-[11px] text-muted">{title}</p>}
          </div>
          <button type="button" onClick={onCancel} disabled={disabled} className="btn-ghost p-1.5" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Visor: zoom con scroll para ver el detalle; recorte encima */}
        <div className="min-h-0 flex-1 overflow-auto bg-black/40 p-2">
          {loadError && (
            <p className="p-6 text-center text-sm text-red-500">
              No se pudo cargar la imagen. Probá de nuevo o subí otra.
            </p>
          )}
          {!workUrl && !loadError && (
            <p className="p-6 text-center text-sm text-muted">Cargando imagen…</p>
          )}
          {workUrl && (
            <div style={{ width: `${zoom}%` }} className="mx-auto">
              <ReactCrop
                crop={crop}
                onChange={(_, percent) => setCrop(percent)}
                aspect={ASPECTS.find((a) => a.key === aspect)?.value}
                keepSelection
                style={{ width: '100%' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={workUrl}
                  alt="Imagen a editar"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  draggable={false}
                />
              </ReactCrop>
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="space-y-3 border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <ZoomIn size={16} className="shrink-0 text-muted" />
            <input
              type="range"
              min={100}
              max={300}
              step={10}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-brand-500"
              aria-label="Zoom"
            />
            <span className="w-10 shrink-0 text-right text-[11px] text-muted">{zoom}%</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted">Recorte:</span>
            {ASPECTS.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={disabled || !workUrl}
                onClick={() => selectAspect(a.key)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  aspect === a.key ? 'border-brand-500 bg-brand-500/15 text-brand-600' : 'border-border hover:bg-surface-2'
                }`}
              >
                {a.label}
              </button>
            ))}
            <button
              type="button"
              disabled={disabled || !workUrl}
              onClick={rotate}
              className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-2"
            >
              <RotateCw size={13} /> Rotar
            </button>
            {hasCrop && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setCrop(undefined)}
                className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-2"
              >
                Quitar selección
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted">
            Arrastrá sobre la imagen para marcar la zona a conservar. Usá el zoom para ver el detalle antes de recortar.
          </p>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} disabled={disabled} className="btn-secondary">
              {mode === 'new' ? 'Omitir esta foto' : 'Cancelar'}
            </button>
            {mode === 'new' && (
              <button type="button" onClick={() => onConfirm(null)} disabled={disabled || !workUrl} className="btn-secondary">
                Subir sin editar
              </button>
            )}
            <button type="button" onClick={confirm} disabled={disabled || !hasChanges} className="btn-primary">
              {busy || working ? 'Procesando…' : mode === 'new' ? 'Recortar y subir' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}