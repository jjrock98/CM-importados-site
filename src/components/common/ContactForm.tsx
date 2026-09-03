'use client';
import { useState } from 'react';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';

export function ContactForm() {
  const [form, setForm] = useState({ nombre: '', email: '', asunto: '', mensaje: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res  = await fetch('/api/contact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.error) { toast.error('Error al enviar. Intentá de nuevo.'); }
    else { setSent(true); toast.success('¡Mensaje enviado!'); }
    setLoading(false);
  };

  if (sent) return (
    <div className="card p-8 text-center animate-scale-in">
      <Send size={40} className="mx-auto mb-3 text-brand-500" />
      <h3 className="font-semibold text-lg">¡Mensaje recibido!</h3>
      <p className="text-muted text-sm mt-2">Te respondemos a la brevedad.</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4 animate-fade-in">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium mb-1">Nombre *</label>
          <input required value={form.nombre} onChange={set('nombre')} className="input-base" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Email *</label>
          <input required type="email" value={form.email} onChange={set('email')} className="input-base" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Asunto</label>
        <input value={form.asunto} onChange={set('asunto')} className="input-base" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Mensaje *</label>
        <textarea required value={form.mensaje} onChange={set('mensaje')} rows={5}
          className="input-base resize-none" />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Enviando…' : <><Send size={16} /> Enviar mensaje</>}
      </button>
    </form>
  );
}
