'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { MailWarning, X, ExternalLink, RefreshCw } from 'lucide-react';
import { getSupabase, hasSupabaseSessionCookie } from '@/lib/supabase/lazy';
import toast from 'react-hot-toast';

// Map email domain → provider URL + label
const EMAIL_PROVIDERS: Record<string, { label: string; url: string }> = {
  'gmail.com':       { label: 'Abrir Gmail',   url: 'https://mail.google.com' },
  'googlemail.com':  { label: 'Abrir Gmail',   url: 'https://mail.google.com' },
  'outlook.com':     { label: 'Abrir Outlook', url: 'https://outlook.live.com' },
  'hotmail.com':     { label: 'Abrir Outlook', url: 'https://outlook.live.com' },
  'hotmail.es':      { label: 'Abrir Outlook', url: 'https://outlook.live.com' },
  'live.com':        { label: 'Abrir Outlook', url: 'https://outlook.live.com' },
  'live.com.ar':     { label: 'Abrir Outlook', url: 'https://outlook.live.com' },
  'yahoo.com':       { label: 'Abrir Yahoo',   url: 'https://mail.yahoo.com'  },
  'yahoo.com.ar':    { label: 'Abrir Yahoo',   url: 'https://mail.yahoo.com'  },
  'icloud.com':      { label: 'Abrir iCloud',  url: 'https://www.icloud.com/mail' },
  'me.com':          { label: 'Abrir iCloud',  url: 'https://www.icloud.com/mail' },
  'proton.me':       { label: 'Abrir Proton',  url: 'https://mail.proton.me'  },
  'protonmail.com':  { label: 'Abrir Proton',  url: 'https://mail.proton.me'  },
};

function getProvider(email: string): { label: string; url: string } | null {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? (EMAIL_PROVIDERS[domain] ?? null) : null;
}

export function EmailVerificationBanner() {
  const pathname = usePathname();
  const [show,         setShow]         = useState(false);
  const [email,        setEmail]        = useState('');
  const [resending,    setResending]    = useState(false);
  const [dismissed,    setDismissed]    = useState(false);
  const alive   = useRef(true);
  const started = useRef(false);
  const unsub   = useRef<(() => void) | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      unsub.current?.();
      unsub.current = null;
    };
  }, []);

  // ✅ PERF: este banner vive en el layout raíz, así que antes forzaba a
  // TODAS las páginas a descargar Supabase (~66 KiB). Ahora solo se carga si
  // hay una cookie de sesión (alguien logueado); un visitante anónimo no
  // puede tener el email sin verificar. Se re-chequea al navegar, por si
  // la persona se logueó sin recargar la página.
  useEffect(() => {
    if (started.current || !hasSupabaseSessionCookie()) return;
    started.current = true;
    (async () => {
      const supabase = await getSupabase();
      if (!alive.current) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!alive.current) return;
      // If email_confirmed_at is null, email not verified
      if (user && !user.email_confirmed_at) {
        setEmail(user.email ?? '');
        setShow(true);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
        if (!alive.current) return;
        if (session?.user && !session.user.email_confirmed_at) {
          setEmail(session.user.email ?? '');
          setShow(true);
        } else {
          setShow(false);
        }
      });
      unsub.current = () => subscription.unsubscribe();
    })();
  }, [pathname]);

  const handleResend = async () => {
    setResending(true);
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/verificar` },
    });
    if (error) {
      toast.error('No se pudo reenviar. Intentá en unos minutos.');
    } else {
      toast.success('¡Email de verificación reenviado!');
    }
    setResending(false);
  };

  if (!show || dismissed) return null;

  const provider = getProvider(email);

  return (
    <div className="relative z-40 bg-yellow-500 dark:bg-yellow-600 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        {/* Icon + message */}
        <div className="flex items-center gap-2.5 text-sm">
          <MailWarning size={16} className="shrink-0" />
          <span className="font-medium">
            Verificá tu cuenta — revisá el email que enviamos a{' '}
            <strong className="underline decoration-dotted">{email}</strong>
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {provider && (
            <a
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <ExternalLink size={13} />
              {provider.label}
            </a>
          )}
          <button
            onClick={handleResend}
            disabled={resending}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60"
          >
            <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
            {resending ? 'Reenviando…' : 'Reenviar email'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-full p-1 hover:bg-white/20 transition-colors"
            aria-label="Cerrar aviso"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}