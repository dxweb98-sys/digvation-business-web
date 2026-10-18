import { DAlert, DButton, DInput } from '@digvation/ui';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';

import { resolveBootstrapWorkspace, useDeploymentBootstrap } from '@digvation/business-runtime';
import { normalizeBackofficeApiError } from '../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../app/localization/backoffice-localization';
import { BackofficeAuthShell } from './backoffice-auth-shell';
import { useBackofficeAuth } from './backoffice-auth-context';

export const PASSWORD_RECOVERY_PATH = '/forgot-password';

function prefersImmediateFocus(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
}

export function BackofficeLoginPage() {
  const bootstrap = useDeploymentBootstrap();
  const location = useLocation();
  const { status, login, refreshSessionContext } = useBackofficeAuth();
  const { copy, t } = useBackofficeLocalization();
  // The auth adapter sends the deployment-resolved workspace; the form only collects credentials.
  const hasTrustedWorkspace = Boolean(resolveBootstrapWorkspace(bootstrap));
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [failedAttempt, setFailedAttempt] = useState(0);
  const [autoFocusIdentifier] = useState(prefersImmediateFocus);
  const passwordInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Return focus to the password once the form is interactive again after a failed attempt.
    if (failedAttempt > 0) passwordInput.current?.focus();
  }, [failedAttempt]);

  if (status === 'hydrating') return null;
  const isOpening = status === 'authenticated';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !hasTrustedWorkspace) return;
    if (!identifier.trim() || !password) {
      setError(t('signInFieldsRequired'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login({ identifier, password });
    } catch (failure) {
      setError(normalizeBackofficeApiError(failure, t('signInFailed')).safeMessage);
      setSubmitting(false);
      setFailedAttempt((attempt) => attempt + 1);
    }
  };

  const clearErrorOnChange = (update: (value: string) => void) => (value: string) => {
    update(value);
    if (error) setError(null);
  };

  if (status === 'unavailable') {
    return (
      <BackofficeAuthShell>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            {copy('Service unavailable')}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
            {copy('Unable to load your current session. Please try again.')}
          </p>
          <DButton className="mt-6" onClick={() => void refreshSessionContext()}>
            {copy('Try again')}
          </DButton>
        </div>
      </BackofficeAuthShell>
    );
  }

  return (
    <BackofficeAuthShell>
      {isOpening ? (
        // Keep the sign-in surface painted while the application route renders.
        <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />
      ) : null}
      <h1 className="text-2xl font-bold leading-8 tracking-[-0.02em] text-[var(--color-text)]">
        {t('signInTitle')}
      </h1>
      <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-muted)]">
        {t('signInSubtitle')}
      </p>

      {isOpening ? (
        <div className="mt-7" aria-live="polite">
          <DButton size="lg" fullWidth loading disabled>
            {t('openingBackoffice')}
          </DButton>
        </div>
      ) : (
        <form className="mt-7" onSubmit={submit} noValidate>
          {hasTrustedWorkspace ? null : (
            <DAlert variant="warning" className="mb-4">
              {t('signInWorkspaceUnavailable')}
            </DAlert>
          )}
          <div className="space-y-4">
            <DInput
              id="backoffice-identifier"
              name="username"
              label={t('usernameOrPhone')}
              value={identifier}
              onChange={clearErrorOnChange(setIdentifier)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus={autoFocusIdentifier}
              disabled={isSubmitting}
              placeholder={copy('Enter your username or phone number')}
            />
            <DInput
              ref={passwordInput}
              id="backoffice-password"
              name="password"
              label={t('password')}
              type="password"
              value={password}
              onChange={clearErrorOnChange(setPassword)}
              autoComplete="current-password"
              disabled={isSubmitting}
              placeholder={copy('Enter your password')}
            />
          </div>
          <div className="mt-2.5 flex justify-end">
            <Link
              to={PASSWORD_RECOVERY_PATH}
              className="rounded-[var(--radius-control)] text-sm font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
            >
              {t('forgotPassword')}
            </Link>
          </div>
          {error ? (
            <DAlert variant="danger" role="alert" className="mt-4">
              {error}
            </DAlert>
          ) : null}
          <DButton
            type="submit"
            size="lg"
            fullWidth
            className="mt-6"
            loading={isSubmitting}
            disabled={!hasTrustedWorkspace}
          >
            {isSubmitting ? t('signingIn') : t('signIn')}
          </DButton>
        </form>
      )}
    </BackofficeAuthShell>
  );
}
