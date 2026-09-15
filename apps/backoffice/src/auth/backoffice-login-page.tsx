import { DButton, DInput, useToast } from '@digvation/ui';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useRuntime } from '@digvation/business-runtime';
import { normalizeBackofficeApiError } from '../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../app/localization/backoffice-localization';
import { AuthenticationLoading } from './authentication-loading';
import { useBackofficeAuth } from './backoffice-auth-context';

export function BackofficeLoginPage() {
  const runtime = useRuntime();
  const location = useLocation();
  const { status, login } = useBackofficeAuth();
  const { showToast } = useToast();
  const { copy, t } = useBackofficeLocalization();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  if (status === 'hydrating') return <AuthenticationLoading />;
  if (status === 'authenticated')
    return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ workspace: runtime.workspace, identifier, password });
    } catch (failure) {
      setError(t('signInFailed'));
      showToast({
        variant: 'danger',
        title: normalizeBackofficeApiError(
          failure,
          t('signInFailed'),
        ).safeMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-background)] p-5">
      <section className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">
          {runtime.branding.productName}
        </p>
        <h1 className="mt-3 text-2xl font-bold">{t('signInToBackoffice')}</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {runtime.branding.businessName ?? runtime.workspace}
        </p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
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
          <DButton type="submit" fullWidth loading={isSubmitting}>
            {t('signIn')}
          </DButton>
        </form>
      </section>
    </main>
  );
}
