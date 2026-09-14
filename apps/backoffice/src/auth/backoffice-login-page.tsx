import { DButton, DInput, useToast } from '@digvation/ui';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useRuntime } from '@digvation/business-runtime';
import { normalizeBackofficeApiError } from '../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../app/localization/backoffice-localization';
import { AuthenticationLoading } from './authentication-loading';
import { useBackofficeAuth } from './backoffice-auth-context';

function BrandMark({
  logoUrl,
  productName,
  inverse = false,
}: {
  logoUrl: string | undefined;
  productName: string;
  inverse?: boolean;
}) {
  return (
    <span
      className={`grid size-11 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)] border ${
        inverse
          ? 'border-white/20 bg-white text-[var(--color-brand)]'
          : 'border-[var(--color-brand)]/15 bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
      }`}
      aria-hidden="true"
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-full object-contain p-1.5" />
      ) : (
        <span className="flex h-5 items-end gap-1">
          <span className="h-3 w-1.5 rounded-full bg-current" />
          <span className="h-5 w-1.5 rounded-full bg-current" />
          <span className="h-4 w-1.5 rounded-full bg-current" />
        </span>
      )}
      <span className="sr-only">{productName}</span>
    </span>
  );
}

function loginFailureMessage(failure: unknown, fallback: string, locale: 'id' | 'en') {
  const normalized = normalizeBackofficeApiError(failure, fallback);
  if (normalized.status === 401 || normalized.code === 'INVALID_CREDENTIALS') {
    return locale === 'id'
      ? 'Username atau kata sandi salah.'
      : 'Username or password is incorrect.';
  }
  if (failure instanceof TypeError) {
    return locale === 'id'
      ? 'Tidak dapat terhubung. Coba lagi.'
      : 'Unable to connect. Please try again.';
  }
  return normalized.safeMessage;
}

export function BackofficeLoginPage() {
  const runtime = useRuntime();
  const location = useLocation();
  const { status, login } = useBackofficeAuth();
  const { showToast } = useToast();
  const { copy, locale, t } = useBackofficeLocalization();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  if (status === 'hydrating') return <AuthenticationLoading />;
  if (status === 'authenticated')
    return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    if (!identifier.trim() || !password) {
      setError(
        locale === 'id'
          ? 'Masukkan nama pengguna dan kata sandi.'
          : 'Enter your username and password.',
      );
      return;
    }

    setSubmitting(true);
    try {
      await login({ workspace: runtime.workspace, identifier, password });
    } catch (failure) {
      const safeMessage = loginFailureMessage(failure, t('signInFailed'), locale);
      setError(safeMessage);
      showToast({ variant: 'danger', title: safeMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const brandContext = runtime.branding.businessName ?? runtime.branding.companyName;
  const isIndonesian = locale === 'id';

  return (
    <main className="min-h-[100svh] overflow-y-auto bg-[var(--color-surface)] text-[var(--color-text)] lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)]">
      <aside className="relative hidden min-h-[100svh] overflow-hidden bg-[var(--color-brand)] px-10 py-9 text-white lg:flex lg:flex-col xl:px-14 xl:py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.22) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute -bottom-28 -right-24 size-[420px] rotate-12 rounded-[72px] border border-white/15" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-10 right-10 size-[300px] rotate-12 rounded-[56px] border border-white/10" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <BrandMark
            logoUrl={runtime.branding.logoUrl}
            productName={runtime.branding.productName}
            inverse
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[-0.01em]">
              {runtime.branding.productName}
            </p>
            {brandContext ? (
              <p className="mt-0.5 truncate text-xs text-white/65">{brandContext}</p>
            ) : null}
          </div>
        </div>

        <div className="relative my-auto max-w-xl py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            Backoffice
          </p>
          <h2 className="mt-5 max-w-lg text-[clamp(2.5rem,4.5vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
            {isIndonesian ? 'Kelola bisnis dalam satu tempat.' : 'Manage your business in one place.'}
          </h2>
          <div className="mt-10 grid max-w-md grid-cols-[80px_1fr] items-center gap-4" aria-hidden="true">
            <span className="h-px bg-white/60" />
            <span className="h-px bg-white/20" />
          </div>
        </div>

        <p className="relative max-w-sm text-xs leading-5 text-white/55">
          {isIndonesian
            ? 'Ruang kerja manajemen untuk kontrol, konfigurasi, dan insight bisnis.'
            : 'A management workspace for business control, configuration, and insight.'}
        </p>
      </aside>

      <section className="relative flex min-h-[100svh] items-center px-5 py-8 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <BrandMark
              logoUrl={runtime.branding.logoUrl}
              productName={runtime.branding.productName}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{runtime.branding.productName}</p>
              {brandContext ? (
                <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                  {brandContext}
                </p>
              ) : null}
            </div>
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-brand)]">
            Backoffice
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            {isIndonesian ? 'Selamat datang' : 'Welcome back'}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--color-text-muted)]">
            {isIndonesian ? 'Masuk ke Backoffice bisnis Anda.' : 'Sign in to your business Backoffice.'}
          </p>
          {brandContext ? (
            <p className="mt-2 text-sm font-medium text-[var(--color-text)]">{brandContext}</p>
          ) : null}

          <form autoComplete="on" className="mt-9 space-y-5" onSubmit={submit}>
            <DInput
              id="backoffice-identifier"
              name="username"
              label={t('usernameOrPhone')}
              value={identifier}
              onChange={setIdentifier}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={isSubmitting}
              placeholder={copy('Enter your username or phone number')}
            />
            <DInput
              id="backoffice-password"
              name="password"
              label={t('password')}
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              disabled={isSubmitting}
              placeholder={copy('Enter your password')}
            />
            <div className="min-h-5" aria-live="polite">
              {error ? (
                <p role="alert" className="text-sm text-[var(--color-danger)]">
                  {error}
                </p>
              ) : null}
            </div>
            <DButton type="submit" fullWidth loading={isSubmitting}>
              {t('signIn')}
            </DButton>
          </form>
        </div>
      </section>
    </main>
  );
}
