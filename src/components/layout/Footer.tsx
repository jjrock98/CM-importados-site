import Link from 'next/link';
import Image from 'next/image';
import { Mail, Phone, MapPin, Instagram, Facebook, Clock } from 'lucide-react';
import { StaggerGrid, StaggerItem } from '@/components/common/AnimateIn';
import type { ContactInfo } from '@/types';

interface Props {
  contactInfo: ContactInfo | null;
}

/** Footer recibe contactInfo desde layout.tsx (leído de Supabase) */
export function Footer({ contactInfo }: Props) {
  const tienda   = process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda';
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  // Fallback a env vars si contact_info está vacío o no cargó
  const email    = contactInfo?.email;
  const telefono = contactInfo?.telefono ?? (whatsapp ? `+${whatsapp}` : null);
  const direccion = contactInfo?.direccion;
  const horario   = contactInfo?.horario;
  const instagram = contactInfo?.instagram;
  const tiktok    = contactInfo?.tiktok;
  const facebook  = contactInfo?.facebook;
  const waUrl     = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ?? '¡Hola!')}`
    : contactInfo?.whatsapp;

  return (
    <footer className="relative mt-16 bg-brand-900 text-white">
      {/* Mismo divisor angular del hero — hace que el footer se sienta parte
          del mismo sistema visual en vez de un bloque separado. */}
      <svg className="absolute -top-[26px] block w-full text-brand-900" viewBox="0 0 1440 40" preserveAspectRatio="none" style={{ height: '26px' }} aria-hidden="true">
        <path d="M0 0L1440 40V0H0Z" fill="currentColor" />
      </svg>

      <div className="mx-auto max-w-7xl px-4 py-12">
        <StaggerGrid className="grid gap-8 md:grid-cols-3">

          {/* Marca */}
          <StaggerItem>
            <div className="flex items-center gap-2 mb-3">
              <Image src="/logo.png" alt={tienda} width={32} height={32} className="rounded-lg object-contain bg-white/95 p-0.5" />
              <h3 className="font-display text-xl font-bold">{tienda}</h3>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Venta mayorista de indumentaria importada — packs por docena y curva surtida. Entregas a domicilio y retiro en local.
            </p>
          </StaggerItem>

          {/* Links */}
          <StaggerItem>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-white/50">
              Información
            </h4>
            <ul className="space-y-2 text-sm">
              {[
                { href: '/faq',      label: 'Preguntas frecuentes' },
                { href: '/terminos', label: 'Términos y condiciones' },
                { href: '/politicas', label: 'Política de privacidad' },
                { href: '/ubicacion', label: 'Cómo llegar' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="group inline-flex items-center gap-1.5 text-white/60 transition-colors hover:text-accent-300">
                    <span className="h-1 w-1 rounded-full bg-accent-500/0 transition-colors group-hover:bg-accent-500" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </StaggerItem>

          {/* Contacto dinámico desde Supabase */}
          <StaggerItem>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-white/50">
              Contacto
            </h4>
            <ul className="space-y-2 text-sm text-white/60">
              {email && (
                <li className="flex items-center gap-2">
                  <Mail size={14} className="shrink-0" />
                  <a href={`mailto:${email}`} className="hover:text-accent-300 transition-colors">{email}</a>
                </li>
              )}
              {telefono && (
                <li className="flex items-center gap-2">
                  <Phone size={14} className="shrink-0" />
                  {waUrl
                    ? <a href={waUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent-300 transition-colors">{telefono}</a>
                    : <span>{telefono}</span>
                  }
                </li>
              )}
              {direccion && (
                <li className="flex items-start gap-2">
                  <MapPin size={14} className="shrink-0 mt-0.5" />
                  <span>{direccion}</span>
                </li>
              )}
              {horario && (
                <li className="flex items-start gap-2">
                  <Clock size={14} className="shrink-0 mt-0.5" />
                  <span>{horario}</span>
                </li>
              )}
              <li className="flex items-center gap-3 pt-1">
                {tiktok && (
                  <a href={tiktok} target="_blank" rel="noopener noreferrer"
                    className="transition-all hover:text-accent-300 hover:-translate-y-0.5" aria-label="TikTok">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
                    </svg>
                  </a>
                )}
                {instagram && (
                  <a href={instagram} target="_blank" rel="noopener noreferrer"
                    className="transition-all hover:text-accent-300 hover:-translate-y-0.5" aria-label="Instagram">
                    <Instagram size={18} />
                  </a>
                )}
                {facebook && (
                  <a href={facebook} target="_blank" rel="noopener noreferrer"
                    className="transition-all hover:text-accent-300 hover:-translate-y-0.5" aria-label="Facebook">
                    <Facebook size={18} />
                  </a>
                )}
              </li>
            </ul>
          </StaggerItem>
        </StaggerGrid>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/50 space-y-1">
          <p>© {new Date().getFullYear()} {tienda}. Todos los derechos reservados.</p>
          <p className="opacity-70">Un emprendimiento de Martirian Claros y Javier Claros</p>
        </div>
      </div>
    </footer>
  );
}
