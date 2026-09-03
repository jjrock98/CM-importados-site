'use client';
import { useState } from 'react';
import { Mail, MailOpen, Trash2, Reply } from 'lucide-react';
import { formatDate } from '@/utils';
import type { ContactMessage } from '@/types';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export function AdminMensajesClient({ initialMessages }: { initialMessages: ContactMessage[] }) {
  const [messages, setMessages] = useState<ContactMessage[]>(initialMessages);
  const [expanded, setExpanded] = useState<string | null>(null);
  const supabase = createClient();

  const markRead = async (id: string, leido: boolean) => {
    const { error } = await supabase.from('contact_messages').update({ leido }).eq('id', id);
    if (error) { toast.error('Error al actualizar'); return; }
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, leido } : m));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este mensaje?')) return;
    const { error } = await supabase.from('contact_messages').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    toast.success('Mensaje eliminado');
  };

  const unreadCount = messages.filter((m) => !m.leido).length;

  return (
    <div>
      {unreadCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/20 px-4 py-2.5 text-sm text-blue-700 dark:text-blue-400">
          <Mail size={15} />
          <span><strong>{unreadCount}</strong> mensaje{unreadCount !== 1 ? 's' : ''} sin leer</span>
        </div>
      )}

      <div className="space-y-3">
        {messages.map((msg) => (
          <div key={msg.id}
            className={`card overflow-hidden border-l-4 transition-all
              ${msg.leido ? 'border-l-border opacity-80' : 'border-l-brand-500'}`}>
            {/* Header */}
            <div
              className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-surface-2 transition-colors"
              onClick={() => {
                setExpanded(expanded === msg.id ? null : msg.id);
                if (!msg.leido) markRead(msg.id, true);
              }}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {msg.leido
                  ? <MailOpen size={16} className="mt-0.5 text-muted shrink-0" />
                  : <Mail     size={16} className="mt-0.5 text-brand-500 shrink-0" />}
                <div className="min-w-0">
                  <p className={`text-sm truncate ${msg.leido ? 'text-muted' : 'font-semibold'}`}>
                    {msg.nombre} · <span className="text-muted font-normal">{msg.email}</span>
                  </p>
                  <p className="text-xs text-muted truncate">{msg.asunto || 'Sin asunto'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted">{formatDate(msg.created_at)}</span>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => markRead(msg.id, !msg.leido)}
                    title={msg.leido ? 'Marcar como no leído' : 'Marcar como leído'}
                    className="btn-ghost p-1.5 text-muted hover:text-brand-600">
                    {msg.leido ? <Mail size={13} /> : <MailOpen size={13} />}
                  </button>
                  <button onClick={() => handleDelete(msg.id)}
                    className="btn-ghost p-1.5 text-muted hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            {expanded === msg.id && (
              <div className="border-t border-border px-4 pb-4 pt-3 animate-fade-in">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.mensaje}</p>
                <a
                  href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.asunto ?? 'Tu consulta')}`}
                  className="mt-4 inline-flex items-center gap-2 text-xs text-brand-600 hover:underline"
                >
                  <Reply size={13} /> Responder por email
                </a>
              </div>
            )}
          </div>
        ))}

        {messages.length === 0 && (
          <div className="card p-12 text-center text-muted">
            <Mail size={40} className="mx-auto mb-3 opacity-20" />
            <p>No hay mensajes de contacto.</p>
          </div>
        )}
      </div>
    </div>
  );
}
