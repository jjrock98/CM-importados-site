'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Phone, Home, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CompletarPerfilPage() {
  const router   = useRouter();
  const params   = useSearchParams();
  const redirect = params.get('redirect') ?? '/';
  const { user, profile, loading } = useAuth();
  const supabase = createClient();

  const [form, setForm] = useState({
    direccion: '', ciudad: '', codigo_postal: '', telefono: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        direccion:     profile.direccion     ?? '',
        ciudad:        profile.ciudad        ?? '',
        codigo_postal: profile.codigo_postal ?? '',
        telefono:      profile.telefono      ?? '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      toast.error('Error al guardar. Intentá de nuevo.');
    } else {
      toast.success('¡Perfil completado!');
      router.push(redirect);
      router.refresh();
    }
    setSaving(false);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><span className="text-muted">Cargando…</span></div>;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8 animate-scale-in">
        <h1 className="font-display text-2xl font-bold mb-1">Completar perfil</h1>
        <p className="text-sm text-muted mb-8">
          Necesitamos al menos tu teléfono para poder avisarte sobre tus pedidos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input required value={form.telefono} onChange={set('telefono')}
              placeholder="Teléfono / WhatsApp" className="input-base pl-10" type="tel" />
          </div>

          {/* ✅ FIX: dirección/ciudad/CP ya no son obligatorios acá — un
               cliente que solo retira en el local nunca los necesita.
               El checkout los vuelve a pedir si en algún pedido elige
               envío a domicilio. Quedan disponibles para quien los quiera
               cargar de una vez. */}
          <p className="text-xs text-muted pt-2">Opcional — si alguna vez pedís envío a domicilio, te lo vamos a pedir de nuevo en el checkout:</p>
          <div className="relative">
            <Home size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={form.direccion} onChange={set('direccion')}
              placeholder="Dirección (calle y número)" className="input-base pl-10" />
          </div>
          <div className="relative">
            <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={form.ciudad} onChange={set('ciudad')}
              placeholder="Ciudad / Localidad" className="input-base pl-10" />
          </div>
          <div className="relative">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={form.codigo_postal} onChange={set('codigo_postal')}
              placeholder="Código postal" className="input-base pl-10" maxLength={8} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full mt-2">
            {saving ? 'Guardando…' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
