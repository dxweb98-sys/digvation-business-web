import { ApiClient } from '@digvation/business-api';
import { resolveBootstrapWorkspace, useDeploymentBootstrap } from '@digvation/business-runtime';
import { DButton, DInput, useToast } from '@digvation/ui';
import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';

import { normalizeBackofficeApiError } from '../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../app/localization/backoffice-localization';
import { AuthenticationLoading } from './authentication-loading';
import { useBackofficeAuth } from './backoffice-auth-context';
import { PublicAuthApi } from './public-auth-api';

export function BackofficeLoginPage() {
  const bootstrap = useDeploymentBootstrap();
  const configuredWorkspace = resolveBootstrapWorkspace(bootstrap);
  const location = useLocation();
  const { status, login, refreshSessionContext } = useBackofficeAuth();
  const { showToast } = useToast();
  const { copy, t } = useBackofficeLocalization();
  const publicAuth = useMemo(
    () => new PublicAuthApi(new ApiClient({ baseUrl: bootstrap.apiBaseUrl })),
    [bootstrap.apiBaseUrl],
  );
  const [mode, setMode] = useState<'login' | 'recovery'>('login');
  const [workspace, setWorkspace] = useState(configuredWorkspace ?? '');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recoverySubmitted, setRecoverySubmitted] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  if (status === 'hydrating') return <AuthenticationLoading />;
  if (status === 'authenticated')
    return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;
  if (status === 'unavailable') {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-background)] p-5">
        <section className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-sm sm:p-8">
          <h1 className="text-lg font-semibold">{copy('Service unavailable')}</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {copy('Unable to load your current session. Please try again.')}
          </p>
          <DButton className="mt-5" onClick={() => void refreshSessionContext()}>
            {copy('Try again')}
          </DButton>
        </section>
      </main>
    );
  }

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({
        identifier,
        password,
        ...(!configuredWorkspace && workspace.trim() ? { workspace: workspace.trim() } : {}),
      });
    } catch (failure) {
      setError(t('signInFailed'));
      showToast({
        variant: 'danger',
        title: normalizeBackofficeApiError(failure, t('signInFailed')).safeMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace.trim() || !identifier.trim() || isSubmitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await publicAuth.requestPasswordReset({
        workspace: workspace.trim(),
        identifier: identifier.trim(),
      });
      setRecoverySubmitted(true);
    } catch {
      // Keep the browser response non-enumerating even when delivery/runtime is unavailable.
      setRecoverySubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-background)] p-5">
      <section className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">
          {bootstrap.branding.productName}
        </p>
        <h1 className="mt-3 text-2xl font-bold">
          {mode === 'login' ? t('signInToBackoffice') : 'Pulihkan kata sandi'}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {mode === 'login'
            ? 'Backoffice'
            : 'Tautan pemulihan akan dikirim ke nomor WhatsApp yang terdaftar pada akun.'}
        </p>

        {mode === 'login' ? (
          <form className="mt-7 space-y-4" onSubmit={submitLogin}>
            {!configuredWorkspace ? (
              <DInput
                label="Workspace"
                value={workspace}
                onChange={setWorkspace}
                autoComplete="organization"
                disabled={isSubmitting}
                placeholder="Masukkan workspace"
              />
            ) : null}
            <DInput
              label={t('usernameOrPhone')}
              value={identifier}
              onChange={setIdentifier}
              autoComplete="username"
              disabled={isSubmitting}
              placeholder={copy('Enter your username or phone number')}
            />
            <DInput
              label={t('password')}
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              disabled={isSubmitting}
              placeholder={copy('Enter your password')}
            />
            {error ? (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-medium text-[var(--color-brand)] hover:underline"
                onClick={() => {
                  setError(null);
                  setRecoverySubmitted(false);
                  setMode('recovery');
                }}
              >
                Lupa kata sandi?
              </button>
            </div>
            <DButton type="submit" fullWidth loading={isSubmitting}>
              {t('signIn')}
            </DButton>
          </form>
        ) : recoverySubmitted ? (
          <div className="mt-7 space-y-5">
            <p role="status" className="text-sm leading-6 text-[var(--color-text)]">
              Jika akun ditemukan, tautan pemulihan akan dikirim ke nomor WhatsApp yang terdaftar.
            </p>
            <DButton
              type="button"
              fullWidth
              variant="secondary"
              onClick={() => {
                setRecoverySubmitted(false);
                setMode('login');
              }}
            >
              Kembali ke halaman masuk
            </DButton>
          </div>
        ) : (
          <form className="mt-7 space-y-4" onSubmit={submitRecovery}>
            {!configuredWorkspace ? (
              <DInput
                label="Workspace"
                value={workspace}
                onChange={setWorkspace}
                autoComplete="organization"
                disabled={isSubmitting}
                placeholder="Masukkan workspace"
              />
            ) : null}
            <DInput
              label="Username atau nomor telepon"
              value={identifier}
              onChange={setIdentifier}
              autoComplete="username"
              disabled={isSubmitting}
              placeholder="Masukkan username atau nomor telepon"
            />
            <DButton
              type="submit"
              fullWidth
              loading={isSubmitting}
              disabled={!workspace.trim() || !identifier.trim()}
            >
              Kirim tautan pemulihan
            </DButton>
            <DButton
              type="button"
              fullWidth
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                setError(null);
                setMode('login');
              }}
            >
              Kembali
            </DButton>
          </form>
        )}
      </section>
    </main>
  );
}
