'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'cookie-consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, date: new Date().toISOString() }));
    setVisible(false);
  };

  const reject = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: false, date: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimiento de cookies"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-sm animate-slide-up"
    >
      <div className="card border border-border shadow-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Cookie size={18} className="text-brand-500 shrink-0" />
            <p className="text-sm font-semibold">Cookies y privacidad</p>
          </div>
          <button onClick={reject} className="text-muted hover:text-foreground transition-colors shrink-0" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted leading-relaxed mb-4">
          Usamos cookies esenciales para el funcionamiento del carrito y la sesión.
          No usamos cookies de seguimiento de terceros.{' '}
          <Link href="/politicas" className="text-brand-600 hover:underline">Ver política de privacidad</Link>.
        </p>

        <div className="flex gap-2">
          <button
            onClick={accept}
            className="btn-primary flex-1 py-2 text-xs"
          >
            Aceptar
          </button>
          <button
            onClick={reject}
            className="btn-secondary flex-1 py-2 text-xs"
          >
            Solo esenciales
          </button>
        </div>
      </div>
    </div>
  );
}
