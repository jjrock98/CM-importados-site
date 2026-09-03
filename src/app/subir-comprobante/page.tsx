'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, CheckCircle2, FileImage, Loader2, Copy, Landmark } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface BankInfo {
  titular: string | null;
  cbu: string | null;
  alias: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  cuit: string | null;
  instrucciones: string | null;
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const copy = () => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };
  return (
    <button onClick={copy} className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-left hover:border-brand-400 transition-colors">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
        <p className="text-sm font-mono font-semibold truncate">{value}</p>
      </div>
      <Copy size={14} className="shrink-0 text-muted" />
    </button>
  );
}

export default function SubirComprobantePage() {
  const router  = useRouter();
  const params  = useSearchParams();
  const orderId = params.get('orderId');
  const emailParam = params.get('email') ?? '';
  const { user } = useAuth();

  const [file,     setFile]     = useState<File | null>(null);
  const [preview,  setPreview]  = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done,     setDone]     = useState(false);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Datos bancarios: sin esto, quien elige transferencia no tiene forma
  //    de saber a dónde transferir. Es público a propósito (ver /api/bank-info).
  useEffect(() => {
    fetch('/api/bank-info')
      .then((r) => r.json())
      .then(({ data }) => setBankInfo(data))
      .catch(() => {});
  }, []);

  const handleFile = (f: File) => {
    if (f.size > 10 * 1024 * 1024) { toast.error('El archivo no puede superar 10 MB'); return; }
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file || !orderId) return;
    // Invitado: necesita el email del pedido para poder identificarse
    // (mismo patrón que /seguimiento) — si no vino en la URL, lo pedimos.
    let email = emailParam;
    if (!user && !email) {
      email = window.prompt('Ingresá el email con el que hiciste el pedido para confirmar tu identidad:') ?? '';
      if (!email) { toast.error('Necesitamos el email del pedido'); return; }
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('orderId', orderId);
      formData.append('file', file);
      if (!user) formData.append('email', email);

      const sessionId = typeof window !== 'undefined'
        ? localStorage.getItem('cart-session-id') ?? '' : '';

      const res = await fetch('/api/upload-comprobante', {
        method: 'POST',
        headers: { 'x-session-id': sessionId },
        body: formData,
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setDone(true);
      toast.success('¡Comprobante enviado!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al subir el comprobante');
    } finally {
      setUploading(false);
    }
  };

  if (!orderId) return (
    <div className="flex min-h-[60vh] items-center justify-center text-muted">
      Pedido no encontrado.
    </div>
  );

  if (done) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <CheckCircle2 size={60} className="text-green-500" />
      <h2 className="font-display text-2xl font-bold">¡Comprobante recibido!</h2>
      <p className="text-muted max-w-sm">
        Revisaremos tu pago y actualizaremos el estado de tu pedido a la brevedad. Te avisamos por email.
      </p>
      <button
        onClick={() => router.push(user ? '/mis-pedidos' : `/seguimiento?id=${orderId}&email=${encodeURIComponent(emailParam)}`)}
        className="btn-primary"
      >
        Ver estado del pedido
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-bold mb-2">Transferí y subí tu comprobante</h1>
      <p className="text-sm text-muted mb-6">
        Pedido <span className="font-mono font-bold">#{orderId.slice(0, 8).toUpperCase()}</span>.
      </p>

      {/* Datos bancarios */}
      {bankInfo ? (
        <div className="card p-5 mb-6 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Landmark size={16} className="text-brand-600" />
            <h2 className="font-semibold text-sm">Datos para transferir</h2>
          </div>
          {bankInfo.titular    && <CopyableField label="Titular" value={bankInfo.titular} />}
          {bankInfo.cbu        && <CopyableField label="CBU" value={bankInfo.cbu} />}
          {bankInfo.alias      && <CopyableField label="Alias" value={bankInfo.alias} />}
          {bankInfo.banco      && <CopyableField label="Banco" value={bankInfo.banco} />}
          {bankInfo.cuit       && <CopyableField label="CUIT" value={bankInfo.cuit} />}
          {bankInfo.tipo_cuenta && <CopyableField label="Tipo de cuenta" value={bankInfo.tipo_cuenta} />}
          {bankInfo.instrucciones && (
            <p className="text-xs text-muted bg-surface-2 rounded-lg px-3 py-2">{bankInfo.instrucciones}</p>
          )}
        </div>
      ) : (
        <div className="card p-5 mb-6 text-sm text-muted">Cargando datos bancarios…</div>
      )}

      <p className="text-sm text-muted mb-3">Una vez que transferís, subí acá el comprobante y lo confirmamos manualmente:</p>

      {/* Drop zone */}
      <div
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed
          p-10 text-center cursor-pointer transition-colors
          ${file ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20' : 'border-border hover:border-brand-400 hover:bg-surface-2'}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview" className="max-h-48 rounded-xl object-contain" />
        ) : (
          <>
            {file ? <FileImage size={40} className="text-brand-500" /> : <Upload size={40} className="text-muted" />}
            <p className="text-sm font-medium">{file ? file.name : 'Arrastrá o hacé click para subir'}</p>
            <p className="text-xs text-muted">JPG, PNG o PDF · máx 10 MB</p>
          </>
        )}
      </div>

      {file && (
        <button onClick={handleUpload} disabled={uploading} className="btn-primary w-full mt-4">
          {uploading
            ? <><Loader2 size={16} className="animate-spin" /> Subiendo…</>
            : <><Upload size={16} /> Confirmar y enviar comprobante</>}
        </button>
      )}
    </div>
  );
}
