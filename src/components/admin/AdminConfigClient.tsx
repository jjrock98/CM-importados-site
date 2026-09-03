'use client';
import { useState } from 'react';
import { Building2, Phone, MapPin, Settings, Save } from 'lucide-react';
import type { BankInfo, ContactInfo, LocationInfo } from '@/types';
import toast from 'react-hot-toast';

type Tab = 'banco' | 'contacto' | 'ubicacion' | 'sitio';

interface Props {
  initialBank:     BankInfo | null;
  initialContact:  ContactInfo | null;
  initialLocation: LocationInfo | null;
  initialSettings: Record<string, string>;
}

export function AdminConfigClient({ initialBank, initialContact, initialLocation, initialSettings }: Props) {
  const [tab, setTab]           = useState<Tab>('banco');
  const [bank, setBank]         = useState(initialBank ?? {} as BankInfo);
  const [contact, setContact]   = useState(initialContact ?? {} as ContactInfo);
  const [location, setLocation] = useState(initialLocation ?? {} as LocationInfo);
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving]     = useState(false);

  const patch = async (table: string, body: Record<string, unknown>) => {
    const res  = await fetch(`/api/admin/settings?table=${table}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
  };

  const saveBank = async () => {
    setSaving(true);
    try {
      await patch('bank_info', {
        titular: bank.titular, cbu: bank.cbu, alias: bank.alias,
        banco: bank.banco, tipo_cuenta: bank.tipo_cuenta,
        cuit: bank.cuit, instrucciones: bank.instrucciones,
      });
      toast.success('Datos bancarios guardados');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
    setSaving(false);
  };

  const saveContact = async () => {
    setSaving(true);
    try {
      await patch('contact_info', {
        email: contact.email, telefono: contact.telefono,
        whatsapp: contact.whatsapp, instagram: contact.instagram,
        facebook: contact.facebook, tiktok: contact.tiktok,
        horario: contact.horario, direccion: contact.direccion,
      });
      toast.success('Información de contacto guardada');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
    setSaving(false);
  };

  const saveLocation = async () => {
    setSaving(true);
    try {
      await patch('location_info', {
        mapa_iframe_url: location.mapa_iframe_url,
        descripcion:     location.descripcion,
        video1_url:      location.video1_url,    video1_titulo: location.video1_titulo,
        video2_url:      location.video2_url,    video2_titulo: location.video2_titulo,
      });
      toast.success('Ubicación guardada');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
    setSaving(false);
  };

  const saveSetting = async (clave: string, valor: string) => {
    setSaving(true);
    try {
      await patch('site_settings', { clave, valor });
      setSettings((p) => ({ ...p, [clave]: valor }));
      toast.success('Configuración guardada');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
    setSaving(false);
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'banco',    label: 'Banco',    icon: <Building2 size={15} /> },
    { id: 'contacto', label: 'Contacto', icon: <Phone size={15} />     },
    { id: 'ubicacion',label: 'Ubicación',icon: <MapPin size={15} />    },
    { id: 'sitio',    label: 'Sitio',    icon: <Settings size={15} />  },
  ];

  const field = (label: string, value: string | null | undefined, onChange: (v: string) => void, opts?: { multiline?: boolean; placeholder?: string }) => (
    <div key={label}>
      <label className="block text-xs font-medium mb-1">{label}</label>
      {opts?.multiline ? (
        <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)}
          rows={3} placeholder={opts.placeholder} className="input-base resize-none text-sm" />
      ) : (
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)}
          placeholder={opts?.placeholder} className="input-base text-sm" />
      )}
    </div>
  );

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px
              ${tab === id ? 'border-brand-500 text-brand-600' : 'border-transparent text-muted hover:text-foreground'}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Bank info */}
      {tab === 'banco' && (
        <div className="card p-6 max-w-xl space-y-4">
          <h2 className="font-semibold mb-2">Datos de transferencia bancaria</h2>
          {field('Titular',     bank.titular,     (v) => setBank({ ...bank, titular: v }))}
          {field('CBU',         bank.cbu,         (v) => setBank({ ...bank, cbu: v }))}
          {field('Alias',       bank.alias,       (v) => setBank({ ...bank, alias: v }))}
          {field('Banco',       bank.banco,       (v) => setBank({ ...bank, banco: v }))}
          {field('Tipo cuenta', bank.tipo_cuenta, (v) => setBank({ ...bank, tipo_cuenta: v }))}
          {field('CUIT',        bank.cuit,        (v) => setBank({ ...bank, cuit: v }))}
          {field('Instrucciones adicionales', bank.instrucciones, (v) => setBank({ ...bank, instrucciones: v }), { multiline: true })}
          <button onClick={saveBank} disabled={saving} className="btn-primary gap-2">
            <Save size={15} />{saving ? 'Guardando…' : 'Guardar datos bancarios'}
          </button>
        </div>
      )}

      {/* Contact info */}
      {tab === 'contacto' && (
        <div className="card p-6 max-w-xl space-y-4">
          <h2 className="font-semibold mb-2">Información de contacto pública</h2>
          {field('Email',                contact.email,     (v) => setContact({ ...contact, email: v }))}
          {field('Teléfono',             contact.telefono,  (v) => setContact({ ...contact, telefono: v }))}
          {field('WhatsApp (solo número)',contact.whatsapp, (v) => setContact({ ...contact, whatsapp: v }), { placeholder: '5491100000000' })}
          {field('Instagram (@usuario)', contact.instagram, (v) => setContact({ ...contact, instagram: v }))}
          {field('Facebook (URL)',        contact.facebook,  (v) => setContact({ ...contact, facebook: v }))}
          {field('TikTok (URL)',          contact.tiktok,    (v) => setContact({ ...contact, tiktok: v }), { placeholder: 'https://tiktok.com/@tuusuario' })}
          {field('Horario de atención',  contact.horario,   (v) => setContact({ ...contact, horario: v }))}
          {field('Dirección física',     contact.direccion, (v) => setContact({ ...contact, direccion: v }))}
          <button onClick={saveContact} disabled={saving} className="btn-primary gap-2">
            <Save size={15} />{saving ? 'Guardando…' : 'Guardar contacto'}
          </button>
        </div>
      )}

      {/* Location info */}
      {tab === 'ubicacion' && (
        <div className="card p-6 max-w-xl space-y-4">
          <h2 className="font-semibold mb-2">Página de Ubicación</h2>
          {field('URL del iframe de Google Maps', location.mapa_iframe_url, (v) => setLocation({ ...location, mapa_iframe_url: v }), { placeholder: 'https://www.google.com/maps/embed?...' })}
          {field('Descripción del lugar', location.descripcion, (v) => setLocation({ ...location, descripcion: v }), { multiline: true })}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted uppercase mb-3">Video 1</p>
            {field('Título del video 1', location.video1_titulo, (v) => setLocation({ ...location, video1_titulo: v }))}
            {field('URL de YouTube (video 1)', location.video1_url, (v) => setLocation({ ...location, video1_url: v }), { placeholder: 'https://youtu.be/...' })}
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted uppercase mb-3">Video 2</p>
            {field('Título del video 2', location.video2_titulo, (v) => setLocation({ ...location, video2_titulo: v }))}
            {field('URL de YouTube (video 2)', location.video2_url, (v) => setLocation({ ...location, video2_url: v }), { placeholder: 'https://youtu.be/...' })}
          </div>
          <button onClick={saveLocation} disabled={saving} className="btn-primary gap-2">
            <Save size={15} />{saving ? 'Guardando…' : 'Guardar ubicación'}
          </button>
        </div>
      )}

      {/* Site settings */}
      {tab === 'sitio' && (
        <div className="max-w-xl space-y-4">
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold mb-2">Modo mantenimiento</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Activar modo mantenimiento</p>
                <p className="text-xs text-muted">Cuando está activo, los visitantes ven una página de mantenimiento.</p>
              </div>
              <button
                onClick={() => saveSetting('mantenimiento', settings['mantenimiento'] === 'true' ? 'false' : 'true')}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${settings['mantenimiento'] === 'true' ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                  ${settings['mantenimiento'] === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Mensaje de mantenimiento</label>
              <textarea
                value={settings['mantenimiento_mensaje'] ?? ''}
                onChange={(e) => setSettings((p) => ({ ...p, mantenimiento_mensaje: e.target.value }))}
                rows={2} className="input-base resize-none text-sm"
              />
              <button
                onClick={() => saveSetting('mantenimiento_mensaje', settings['mantenimiento_mensaje'])}
                disabled={saving} className="btn-secondary mt-2 text-xs py-1.5 gap-1.5">
                <Save size={13} /> Guardar mensaje
              </button>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="font-semibold mb-2">⏱️ Retención de stock — pagos manuales</h2>
            <p className="text-xs text-muted -mt-2">
              Horas que se mantiene reservado el stock de un pedido con transferencia/efectivo
              antes de cancelarlo automáticamente y devolver las unidades a la venta.
            </p>
            <div>
              <label className="block text-xs font-medium mb-1">Tiempo límite (horas)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="1" max="720" step="1"
                  value={settings['retencion_horas_transferencia'] ?? '48'}
                  onChange={(e) => setSettings((p) => ({ ...p, retencion_horas_transferencia: e.target.value }))}
                  className="input-base text-sm max-w-32"
                />
                <span className="text-xs text-muted">
                  ({Math.round(Number(settings['retencion_horas_transferencia'] ?? 48) / 24 * 10) / 10} días aprox.)
                </span>
              </div>
              <button
                onClick={() => saveSetting('retencion_horas_transferencia', settings['retencion_horas_transferencia'])}
                disabled={saving} className="btn-secondary mt-2 text-xs py-1.5 gap-1.5">
                <Save size={13} /> Guardar tiempo límite
              </button>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="font-semibold mb-2">Datos de la tienda</h2>
            <div>
              <label className="block text-xs font-medium mb-1">Nombre de la tienda</label>
              <input value={settings['nombre_tienda'] ?? ''} className="input-base text-sm"
                onChange={(e) => setSettings((p) => ({ ...p, nombre_tienda: e.target.value }))} />
              <button onClick={() => saveSetting('nombre_tienda', settings['nombre_tienda'])}
                disabled={saving} className="btn-secondary mt-2 text-xs py-1.5 gap-1.5">
                <Save size={13} /> Guardar
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Descripción SEO</label>
              <textarea value={settings['descripcion_tienda'] ?? ''} rows={2} className="input-base resize-none text-sm"
                onChange={(e) => setSettings((p) => ({ ...p, descripcion_tienda: e.target.value }))} />
              <button onClick={() => saveSetting('descripcion_tienda', settings['descripcion_tienda'])}
                disabled={saving} className="btn-secondary mt-2 text-xs py-1.5 gap-1.5">
                <Save size={13} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}