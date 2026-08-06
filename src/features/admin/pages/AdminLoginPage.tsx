import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

const schema = z.object({
  username: z.string().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

/**
 * Login security notes
 * ---------------------
 * The actual rate limiting, account lock, IP lock, and audit logging all
 * happen server-side in the Worker (see /workers/src/routes/auth.ts) --
 * that's the only place these controls can be trustworthy, since any
 * client-side check can be bypassed. This form's job is to:
 *   1. Never allow more than one in-flight submit
 *   2. Surface the server's lockout / captcha-required state clearly
 *   3. Render a CAPTCHA widget once the server signals it's required
 *      (after N failed attempts, per the server's own threshold)
 */
export function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [locked, setLocked] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      // captchaToken would come from a rendered CAPTCHA widget (e.g.
      // Cloudflare Turnstile) once captchaRequired is true. Wiring the
      // actual widget requires a site key from Cloudflare Turnstile setup.
      await login(values.username, values.password, captchaRequired ? 'placeholder' : undefined);
      const from = (location.state as { from?: string } | null)?.from ?? '/admin';
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setLocked(true);
          setServerError('Too many attempts. This account is temporarily locked. Try again later.');
        } else if (err.status === 401) {
          setServerError('Incorrect username or password.');
        } else if (err.status === 412) {
          setCaptchaRequired(true);
          setServerError('Please complete the CAPTCHA and try again.');
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] px-4">
      <div className="w-full max-w-sm bg-white rounded-[var(--radius-card)] border border-[var(--color-line)] shadow-[var(--shadow-soft)] p-8">
        <h1 className="font-display text-2xl font-medium mb-1">Icebrim Admin</h1>
        <p className="text-sm text-[var(--color-ink-soft)] mb-6">Sign in to manage your site.</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1.5">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              className="form-input"
              disabled={locked}
              {...register('username')}
            />
            {errors.username && (
              <p className="text-xs text-[var(--color-coral-deep)] mt-1">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="form-input"
              disabled={locked}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-[var(--color-coral-deep)] mt-1">{errors.password.message}</p>
            )}
          </div>

          {captchaRequired && !locked && (
            <div className="rounded-lg border border-dashed border-[var(--color-line)] p-4 text-xs text-[var(--color-ink-soft)]">
              CAPTCHA widget renders here (e.g. Cloudflare Turnstile) once a Turnstile site key is
              configured in the environment.
            </div>
          )}

          {serverError && (
            <p role="alert" className="text-sm text-[var(--color-coral-deep)]">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting || locked}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>

      <style>{`.form-input {
        width: 100%;
        border-radius: 0.75rem;
        border: 1px solid var(--color-line);
        padding: 0.6rem 0.85rem;
        font-size: 0.95rem;
        background-color: #ffffff;
        color: var(--color-ink);
        color-scheme: light;
      }
      .form-input::placeholder {
        color: var(--color-ink-soft);
        opacity: 1;
      }
      .form-input:focus-visible {
        outline: 2px solid var(--color-coral-deep);
        outline-offset: 2px;
      }
      .form-input:disabled {
        background-color: var(--color-surface);
        opacity: 0.7;
      }`}</style>
    </div>
  );
}
