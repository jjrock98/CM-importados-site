'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User, MapPin, Phone, Mail, ShoppingBag, Save, Key, Loader2, Trash2, AlertTriangle, Wallet } from 'lucide-react';
import type { Profile } from '@/types';
import { cn } from '@/utils';
import toast from 'react-hot-toast';
import { CuentaCorrienteTab } from './CuentaCorrienteTab';

type Tab = 'datos' | 'seguridad' | 'estado-cuenta' | 'cuenta';
interface Props { profile: Profile; ordersCount: number }

export function ProfileClient({ profile: initial, ordersCount }: Props) {
  const supabase = createClient();
  const router   = useRouter();
  const [profile, setProfile] = useState(initial);
  const [saving,  setSaving]  = useState(false);
  const [tab,     setTab]     = useState<Tab>('datos');
  const [pwForm,  setPwForm]  = useState({ nuevo: '', confirmar: '' });
  const [savingPw, setSavingPw] = useState(false);

  // Delete account state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ✅ Muestra la pestaña "Cuenta corriente" solo si el cliente la tiene
  // habilitada (evita una pestaña vacía para el 99% que paga de otra forma).
  const [tieneCuentaCorriente, setTieneCuentaCorriente] = useState(false);
  useEffect(() => {
    fetch('/api/mi-cuenta/condiciones')
      .then((r) => r.json())
      .then(({ data }) => setTieneCuentaCorriente(!!data && data.limite_cuenta_corriente > 0))
      .catch(() => {});
  }, []);

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfile((p) => ({ ...p, [k]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res  = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: profile.nombre, telefono: profile.telefono,
        direccion: profile.direccion, ciudad: profile.ciudad,
        codigo_postal: profile.codigo_postal,
      }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else toast.success('Perfil actualizado');
    setSaving(false);
  };

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.nuevo !== pwForm.confirmar) { toast.error('Las contraseñas no coinciden'); return; }
    if (pwForm.nuevo.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.nuevo });
    if (error) toast.error('No se pudo cambiar la contraseña');
    else { toast.success('Contraseña actualizada'); setPwForm({ nuevo: '', confirmar: '' }); }
    setSavingPw(false);
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== 'ELIMINAR') { toast.error('Escribí ELIMINAR para confirmar'); return; }
    setDeleting(true);
    const res  = await fetch('/api/profile/delete', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmText: 'ELIMINAR' }),
    });
    const data = await res.json();
    if (data.error) {
      toast.error(data.error);
      setDeleting(false);
    } else {
      await supabase.auth.signOut();
      toast.success('Cuenta eliminada. ¡Hasta luego!');
      router.push('/');
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'datos',    label: 'Mis datos',  icon: <User  size={14} /> },
    { id: 'seguridad',label: 'Seguridad',  icon: <Key   size={14} /> },
    ...(tieneCuentaCorriente ? [{ id: 'estado-cuenta' as Tab, label: 'Cuenta corriente', icon: <Wallet size={14} /> }] : []),
    { id: 'cuenta',   label: 'Mi cuenta',  icon: <Trash2 size={14} className="text-red-500" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-5 flex items-center gap-5">
        <div className="relative h-16 w-16 overflow-hidden rounded-full bg-brand-100 dark:bg-brand-950 shrink-0">
          {profile.avatar_url
            ? <Image src={profile.avatar_url} alt="Avatar" fill className="object-cover" sizes="64px" />
            : <div className="flex h-full items-center justify-center"><User size={28} className="text-brand-500" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg truncate">{profile.nombre ?? 'Sin nombre'}</p>
          <p className="text-sm text-muted truncate">{profile.email}</p>
        </div>
        <Link href="/mis-pedidos" className="flex flex-col items-center rounded-xl bg-surface-2 px-4 py-3 text-center hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-colors">
          <ShoppingBag size={18} className="text-brand-500 mb-1" />
          <span className="text-xl font-bold">{ordersCount}</span>
          <span className="text-xs text-muted">pedidos</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all',
              tab === id ? 'border-brand-500 text-brand-600' : 'border-transparent text-muted hover:text-foreground',
              id === 'cuenta' && tab === id && 'border-red-500 text-red-500'
            )}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── DATOS PERSONALES ── */}
      {tab === 'datos' && (
        <form onSubmit={handleSave} className="card p-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium mb-1.5"><User size={12} className="inline mr-1" />Nombre</label>
              <input value={profile.nombre ?? ''} onChange={set('nombre')} className="input-base" placeholder="Tu nombre" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5"><Mail size={12} className="inline mr-1" />Email</label>
              <input value={profile.email} disabled className="input-base opacity-60 cursor-not-allowed bg-surface-2" />
              <p className="text-xs text-muted mt-1">No se puede cambiar desde aquí.</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5"><Phone size={12} className="inline mr-1" />Teléfono</label>
              <input value={profile.telefono ?? ''} onChange={set('telefono')} type="tel" className="input-base" placeholder="+54 11 0000-0000" />
            </div>
          </div>
          <div className="border-t border-border pt-5">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <MapPin size={12} /> Dirección de entrega predeterminada
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Dirección</label>
                <input value={profile.direccion ?? ''} onChange={set('direccion')} className="input-base" placeholder="Calle y número" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Ciudad</label>
                <input value={profile.ciudad ?? ''} onChange={set('ciudad')} className="input-base" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Código postal</label>
                <input value={profile.codigo_postal ?? ''} onChange={set('codigo_postal')} className="input-base" maxLength={8} />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" />Guardando…</> : <><Save size={14} />Guardar cambios</>}
            </button>
          </div>
        </form>
      )}

      {/* ── SEGURIDAD ── */}
      {tab === 'seguridad' && (
        <form onSubmit={handleChangePw} className="card p-6 space-y-4">
          <p className="text-sm text-muted">Si iniciaste sesión con Google, podés establecer una contraseña adicional.</p>
          <div>
            <label className="block text-xs font-medium mb-1.5">Nueva contraseña</label>
            <input type="password" value={pwForm.nuevo} onChange={(e) => setPwForm(p => ({ ...p, nuevo: e.target.value }))}
              placeholder="Mínimo 6 caracteres" className="input-base" minLength={6} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Confirmar contraseña</label>
            <input type="password" value={pwForm.confirmar} onChange={(e) => setPwForm(p => ({ ...p, confirmar: e.target.value }))}
              placeholder="Repetí la contraseña" className="input-base" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingPw || !pwForm.nuevo} className="btn-primary gap-2">
              {savingPw ? <><Loader2 size={14} className="animate-spin" />Guardando…</> : <><Key size={14} />Cambiar contraseña</>}
            </button>
          </div>
        </form>
      )}

      {/* ── ESTADO DE CUENTA (cuenta corriente) ── */}
      {tab === 'estado-cuenta' && <CuentaCorrienteTab />}

      {/* ── ELIMINAR CUENTA ── */}
      {tab === 'cuenta' && (
        <div className="space-y-4">
          <div className="card p-5 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-red-700 dark:text-red-400">Zona de peligro</h3>
                <p className="text-sm text-red-600/80 dark:text-red-400/70 mt-1">
                  Eliminar tu cuenta es permanente. Se borrarán tus datos personales y no podrás acceder a tu historial.
                  Los pedidos se anonimizarán pero no se borran por razones de registro.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-red-700 dark:text-red-400">
                  Para confirmar, escribí <strong>ELIMINAR</strong> en mayúsculas:
                </label>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="ELIMINAR"
                  className="input-base border-red-200 dark:border-red-800 focus:border-red-500 focus:ring-red-200"
                />
              </div>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== 'ELIMINAR' || deleting}
                className={cn(
                  'w-full rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all',
                  deleteConfirmText === 'ELIMINAR'
                    ? 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
                    : 'bg-red-100 text-red-400 cursor-not-allowed dark:bg-red-950/30 dark:text-red-700'
                )}
              >
                {deleting
                  ? <><Loader2 size={14} className="animate-spin" />Eliminando…</>
                  : <><Trash2 size={14} />Eliminar mi cuenta permanentemente</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
