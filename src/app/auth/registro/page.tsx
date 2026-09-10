'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, User, Chrome, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/utils';
import toast from 'react-hot-toast';
import { TurnstileWidget } from '@/components/common/TurnstileWidget';

// ── Validation schema with smart rules ──────────────────────
const schema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo')
    .regex(
      /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/,
      'El nombre solo puede contener letras, no números'
    )
    .refine((v) => v.trim().split(/\s+/).length >= 1, 'Ingresá al menos un nombre'),

  email: z
    .string()
    .email('Ingresá un email válido')
    .max(255, 'El email es demasiado largo')
    .toLowerCase()
    .refine((v) => !v.includes('+'), 'No se permiten alias de email (símbolo +)'),

  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(128, 'La contraseña es demasiado larga')
    .refine((v) => !/^\d+$/.test(v), 'La contraseña no puede ser solo números')
    .refine((v) => v !== v.toLowerCase() || /[0-9!@#$%^&*]/.test(v), 
      'Usá al menos una mayúscula o un número'),

  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

// Password strength calculator
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: 'Muy débil', color: 'bg-red-500' };
  if (score === 2) return { score: 2, label: 'Débil',     color: 'bg-orange-500' };
  if (score === 3) return { score: 3, label: 'Regular',   color: 'bg-yellow-500' };
  if (score === 4) return { score: 4, label: 'Buena',     color: 'bg-blue-500' };
  return                  { score: 5, label: 'Excelente', color: 'bg-green-500' };
}

export default function RegistroPage() {
  const router   = useRouter();
  const params   = useSearchParams();
  const redirect = params.get('redirect') ?? '/';
  const supabase = createClient();

  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, touchedFields },
  } = useForm<FormData>({ resolver: zodResolver(schema), mode: 'onChange' });

  const passwordValue = watch('password') ?? '';
  const strength = getPasswordStrength(passwordValue);

  const handleRegister = async (data: FormData) => {
    if (!captchaToken) {
      toast.error('Completá la verificación anti-bot antes de registrarte.');
      return;
    }
    setLoading(true);
    // ✅ NUEVO: ya no se llama a supabase.auth.signUp() directo desde acá —
    // pasa por /api/auth/register, que aplica captcha + rate limit antes de
    // crear la cuenta (ver ese endpoint para el detalle).
    const res = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre:         data.nombre.trim(),
        email:          data.email,
        password:       data.password,
        turnstileToken: captchaToken,
      }),
    });
    const result = await res.json().catch(() => ({ error: 'Error inesperado' }));
    if (!res.ok || result.error) {
      toast.error(result.error ?? 'No se pudo crear la cuenta');
      setCaptchaToken(null);
      setLoading(false);
      return;
    }
    toast.success('¡Cuenta creada! Revisá tu email para verificarla.');
    router.push(`/auth/login?redirect=${redirect}&verify=1`);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: `${window.location.origin}/auth/callback?next=${redirect}` },
    });
  };

  const FieldError = ({ name }: { name: keyof FormData }) =>
    errors[name] ? (
      <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
        <XCircle size={12} /> {errors[name]!.message}
      </p>
    ) : null;

  const FieldOk = ({ name, value }: { name: keyof FormData; value: string }) =>
    !errors[name] && touchedFields[name] && value?.length > 0 ? (
      <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
    ) : null;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8 animate-scale-in">
        <h1 className="font-display text-2xl font-bold text-center mb-1">Crear cuenta</h1>
        <p className="text-center text-sm text-muted mb-8">Registrate para comprar fácilmente</p>

        <button onClick={handleGoogle} className="btn-secondary w-full mb-4 gap-3">
          <Chrome size={18} className="text-red-500" />
          Registrarse con Google
        </button>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs text-muted"><span className="bg-surface px-2">o completá el formulario</span></div>
        </div>

        <form onSubmit={handleSubmit(handleRegister)} className="space-y-4" noValidate>
          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Nombre completo *</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                {...register('nombre')}
                placeholder="Juan García"
                className={cn(
                  'input-base pl-9 pr-8',
                  errors.nombre && 'border-red-400 focus:border-red-500 focus:ring-red-200'
                )}
                autoComplete="name"
              />
              <FieldOk name="nombre" value={watch('nombre') ?? ''} />
            </div>
            <FieldError name="nombre" />
            <p className="mt-1 text-xs text-muted">Solo letras, sin números ni caracteres especiales.</p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Email *</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                {...register('email')}
                type="email"
                placeholder="tu@email.com"
                className={cn(
                  'input-base pl-9 pr-8',
                  errors.email && 'border-red-400 focus:border-red-500 focus:ring-red-200'
                )}
                autoComplete="email"
              />
              <FieldOk name="email" value={watch('email') ?? ''} />
            </div>
            <FieldError name="email" />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Contraseña *</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                {...register('password')}
                type={showPw ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                className={cn(
                  'input-base pl-9 pr-16',
                  errors.password && 'border-red-400 focus:border-red-500 focus:ring-red-200'
                )}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                aria-label={showPw ? 'Ocultar' : 'Mostrar'}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Password strength bar */}
            {passwordValue.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-all duration-300',
                        strength.score >= level ? strength.color : 'bg-surface-2'
                      )}
                    />
                  ))}
                </div>
                <p className={cn('text-xs', strength.score <= 2 ? 'text-red-500' : strength.score <= 3 ? 'text-yellow-600' : 'text-green-600')}>
                  {strength.label}
                </p>
              </div>
            )}

            <FieldError name="password" />
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Repetir contraseña *</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                {...register('confirmPassword')}
                type={showPw ? 'text' : 'password'}
                placeholder="Repetí tu contraseña"
                className={cn(
                  'input-base pl-9 pr-8',
                  errors.confirmPassword && 'border-red-400 focus:border-red-500 focus:ring-red-200'
                )}
                autoComplete="new-password"
              />
              <FieldOk name="confirmPassword" value={watch('confirmPassword') ?? ''} />
            </div>
            <FieldError name="confirmPassword" />
          </div>

          <TurnstileWidget onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} className="mt-2 flex justify-center" />

          <button type="submit" disabled={loading || !captchaToken} className="btn-primary w-full mt-2">
            {loading ? 'Creando cuenta…' : 'Crear cuenta gratuita'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Al registrarte aceptás nuestros{' '}
          <Link href="/terminos" className="text-brand-600 hover:underline">Términos y condiciones</Link>
          {' '}y{' '}
          <Link href="/politicas" className="text-brand-600 hover:underline">Política de privacidad</Link>.
        </p>

        <p className="mt-3 text-center text-sm text-muted">
          ¿Ya tenés cuenta?{' '}
          <Link href={`/auth/login?redirect=${redirect}`} className="text-brand-600 font-medium hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}