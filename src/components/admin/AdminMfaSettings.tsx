'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 'loading' | 'off' | 'enrolling' | 'on';

/**
 * Verificación en dos pasos (2FA/TOTP) para la cuenta admin, usando el
 * módulo MFA de Supabase Auth — nativo, sin costo extra ni servicio
 * externo. Compatible con Google Authenticator, Authy, 1Password, etc.
 *
 * El enforcement real (exigir el código para entrar a /admin) vive en
 * middleware.ts + admin/layout.tsx, comparando aal actual vs aal exigido
 * por los factores registrados. Este componente solo gestiona el alta/baja
 * del factor.
 */
export function AdminMfaSettings() {
  const supabase = createClient();

  const [step, setStep]         = useState<Step>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode]     = useState<string | null>(null);
  const [secret, setSecret]     = useState<string | null>(null);
  const [code, setCode]         = useState('');
  const [busy, setBusy]         = useState(false);

  const loadFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { toast.error('No se pudo cargar el estado de 2FA.'); return; }
    // data.totp solo trae factores YA verificados — el tipado de Supabase
    // los distingue así. Un factor a medio registrar (status 'unverified')
    // solo aparece en data.all, filtrando por factor_type.
    const verified = data.totp[0];
    if (verified) {
      setFactorId(verified.id);
      setStep('on');
    } else {
      setStep('off');
    }
  };

  useEffect(() => { loadFactors(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnroll = async () => {
    setBusy(true);
    // Si había un intento sin terminar (factor 'unverified' colgado de una
    // sesión anterior), Supabase no deja crear otro con el mismo nombre —
    // se limpia antes de pedir uno nuevo.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    const stale = existing?.all.find(
      (f) => f.factor_type === 'totp' && f.status === 'unverified'
    );
    if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error || !data) {
      toast.error('No se pudo iniciar el alta de 2FA.');
      setBusy(false);
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStep('enrolling');
    setBusy(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      toast.error('Error al verificar. Probá de nuevo.');
      setBusy(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId, challengeId: challenge.id, code,
    });
    if (verifyError) {
      toast.error('Código incorrecto. Revisá la hora de tu teléfono y probá de nuevo.');
      setCode('');
      setBusy(false);
      return;
    }
    toast.success('¡Verificación en dos pasos activada!');
    setCode(''); setQrCode(null); setSecret(null);
    setStep('on');
    setBusy(false);
  };

  const handleDisable = async () => {
    if (!factorId) return;
    if (!confirm('¿Desactivar la verificación en dos pasos para esta cuenta?')) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { toast.error('No se pudo desactivar.'); setBusy(false); return; }
    toast.success('Verificación en dos pasos desactivada.');
    setFactorId(null);
    setStep('off');
    setBusy(false);
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        {step === 'on'
          ? <ShieldCheck size={20} className="text-green-500" />
          : <ShieldOff size={20} className="text-muted" />}
        <h2 className="font-semibold text-lg">Verificación en dos pasos (2FA)</h2>
      </div>
      <p className="text-sm text-muted">
        Suma un código de 6 dígitos (Google Authenticator, Authy, 1Password, etc.)
        al iniciar sesión en el panel de admin, además de la contraseña.
      </p>

      {step === 'loading' && <Loader2 className="animate-spin text-muted" size={20} />}

      {step === 'off' && (
        <button onClick={handleEnroll} disabled={busy} className="btn-primary">
          {busy ? 'Generando…' : 'Activar verificación en dos pasos'}
        </button>
      )}

      {step === 'enrolling' && qrCode && (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-2 p-4">
            <div
              className="h-40 w-40 [&_svg]:h-full [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrCode }}
            />
            <p className="text-xs text-muted text-center">
              Escaneá el código con tu app de autenticación. Si no podés escanear,
              ingresá esta clave manualmente:
            </p>
            {secret && (
              <code className="rounded bg-surface px-2 py-1 text-xs font-mono break-all">
                {secret}
              </code>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Código de 6 dígitos generado por la app
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="input-base text-center text-xl tracking-[0.4em] font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || code.length !== 6} className="btn-primary">
              {busy ? 'Verificando…' : 'Confirmar y activar'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('off'); setQrCode(null); setSecret(null); setCode(''); }}
              className="btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {step === 'on' && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            Activada — se va a pedir el código en cada inicio de sesión.
          </span>
          <button onClick={handleDisable} disabled={busy} className="btn-secondary text-sm">
            Desactivar
          </button>
        </div>
      )}
    </div>
  );
}