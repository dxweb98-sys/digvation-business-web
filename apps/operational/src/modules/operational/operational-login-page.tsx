import { DButton, DInput, useToast } from '@digvation/ui';
import { useState, type FormEvent } from 'react';

import type { AuthPort, AuthSession } from '@digvation/business-auth';
import { useRuntime } from '@digvation/business-runtime';
import { useOperationalLocalization } from '../../app/localization/operational-localization';

interface OperationalLoginPageProps {
  authPort: AuthPort;
  onAuthenticated: (session: AuthSession) => void;
}

function BrandMark({ logoUrl }: { logoUrl: string | undefined }) {
  return (
    <span
      className="grid size-14 place-items-center overflow-hidden rounded-2xl border border-[var(--color-brand)]/15 bg-[var(--color-brand)] text-white shadow-[0_14px_40px_-24px_var(--color-brand)]"
      aria-hidden="true"
    >
      {logoUrl ? (
        <span className="grid size-11 place-items-center rounded-xl bg-white p-1.5">
          <img src={logoUrl} alt="" className="size-full object-contain" />
        </span>
      ) : (
        <span className="flex h-6 items-end gap-1.5">
          <span className="h-3.5 w-1.5 rounded-full bg-current" />
          <span className="h-6 w-1.5 rounded-full bg-current" />
          <span className="h-[18px] w-1.5 rounded-full bg-current" />
        </span>
      )}
    </span>
  );
}

function loginFailureMessage(error: unknown, locale: 'id-ID' | 'en-US') {
  const isIndonesian = locale === 'id-ID';
  if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
    return isIndonesian
      ? 'Username atau kata sandi salah.'
      : 'Username or password is incorrect.';
  }
  if (error instanceof TypeError) {
    return isIndonesian
      ? 'Tidak dapat terhubung. Coba lagi.'
      : 'Unable to connect. Please try again.';
  }
  return isIndonesian
    ? 'Masuk belum dapat diproses. Coba lagi.'
    : 'Sign in could not be completed. Please try again.';
}

/** Operational-owned login composition using the canonical shared field, button, and toast primitives. */
export function OperationalLoginPage({ authPort, onAuthenticated }: OperationalLoginPageProps) {
  const runtime = useRuntime();
  const { locale } = useOperationalLocalization();
  const { showToast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const isIndonesian = locale === 'id-ID';
  const brandContext = runtime.branding.businessName ?? runtime.branding.companyName;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!identifier.trim() || !password) {
      showToast({
        title: isIndonesian ? 'Data masuk belum lengkap' : 'Sign-in details are incomplete',
        description: isIndonesian
          ? 'Masukkan ID pengguna dan kata sandi.'
          : 'Enter your user ID and password.',
        variant: 'danger',
      });
      return;
    }

    setSubmitting(true);
    try {
      const session = await authPort.login({ identifier: identifier.trim(), password });
      showToast({
        title: isIndonesian ? 'Masuk berhasil' : 'Signed in',
        description: isIndonesian
          ? `Selamat datang, ${session.identity.displayName}.`
          : `Welcome, ${session.identity.displayName}.`,
        variant: 'success',
      });
      onAuthenticated(session);
    } catch (error) {
      setSubmitting(false);
      showToast({
        title: isIndonesian ? 'Masuk gagal' : 'Sign in failed',
        description: loginFailureMessage(error, locale),
        variant: 'danger',
      });
    }
  };

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-y-auto overflow-x-hidden bg-[var(--color-background)] px-5 py-10 text-[var(--color-text)] sm:px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-brand) 1px, transparent 1px), linear-gradient(90deg, var(--color-brand) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[min(78vw,760px)] -translate-x-1/2 -translate-y-1/2 rotate-6 rounded-[5rem] border border-[var(--color-brand)]/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[min(58vw,560px)] -translate-x-1/2 -translate-y-1/2 -rotate-3 rounded-[4rem] border border-[var(--color-brand)]/10"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[var(--color-brand)]" aria-hidden="true" />

      <section className="relative z-10 w-full max-w-[500px]">
        <header className="text-center">
          <div className="flex justify-center">
            <BrandMark logoUrl={runtime.branding.logoUrl} />
          </div>
          <p className="mt-5 text-sm font-semibold tracking-[-0.01em] text-[var(--color-text-muted)]">
            {runtime.branding.productName}
          </p>
          <h1 className="mt-2 text-[clamp(2.6rem,8vw,4.5rem)] font-semibold leading-none tracking-[-0.06em]">
            {isIndonesian ? 'Operasional' : 'Operational'}
          </h1>
          {brandContext ? (
            <div className="mt-5 flex justify-center">
              <span className="max-w-full truncate rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] shadow-sm">
                {brandContext}
              </span>
            </div>
          ) : null}
        </header>

        <form
          autoComplete="on"
          className="mt-9 border-y border-[var(--color-border)] bg-[var(--color-surface)]/70 py-7 sm:px-6 sm:py-8 [&_input]:min-h-12 [&_input]:text-base"
          onSubmit={submit}
        >
          <div className="space-y-5">
            <DInput
              id="operational-identifier"
              name="username"
              label={isIndonesian ? 'ID pengguna' : 'User ID'}
              value={identifier}
              disabled={isSubmitting}
              onChange={setIdentifier}
              placeholder={isIndonesian ? 'Username atau email' : 'Username or email'}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
            <DInput
              id="operational-password"
              name="password"
              label={isIndonesian ? 'Kata sandi' : 'Password'}
              type="password"
              value={password}
              disabled={isSubmitting}
              onChange={setPassword}
              placeholder={isIndonesian ? 'Masukkan kata sandi' : 'Enter your password'}
              autoComplete="current-password"
            />
            <DButton type="submit" fullWidth loading={isSubmitting} className="min-h-12 text-base">
              {isIndonesian ? 'Masuk' : 'Sign in'}
            </DButton>
          </div>
        </form>

        <p className="mx-auto mt-5 max-w-sm text-center text-xs leading-5 text-[var(--color-text-muted)]">
          {isIndonesian
            ? 'Masuk untuk membuka ruang kerja operasional yang tersedia untuk akun Anda.'
            : 'Sign in to open the operational workspace available to your account.'}
        </p>
      </section>
    </main>
  );
}
