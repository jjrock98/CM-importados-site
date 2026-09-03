'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props { orderId: string }

export function OrderCancelButton({ orderId }: Props) {
  const router = useRouter();
  const [loading,  setLoading]  = useState(false);
  const [confirm,  setConfirm]  = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    const res  = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
    const data = await res.json();

    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success('Pedido cancelado');
      router.refresh();
    }
    setLoading(false);
    setConfirm(false);
  };

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400"
      >
        <XCircle size={14} className="inline mr-1.5" />
        Cancelar pedido
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 space-y-3">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">
        ¿Confirmás la cancelación?
      </p>
      <p className="text-xs text-red-600/80 dark:text-red-400/70">
        Esta acción no se puede deshacer.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          disabled={loading}
          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
          Sí, cancelar
        </button>
        <button
          onClick={() => setConfirm(false)}
          disabled={loading}
          className="flex-1 rounded-lg border border-red-200 dark:border-red-800 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          No, volver
        </button>
      </div>
    </div>
  );
}
