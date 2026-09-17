import { resolveBootstrapWorkspace, useDeploymentBootstrap } from '@digvation/business-runtime';
import { DAlert, DButton, DInput } from '@digvation/ui';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import { useBackofficeLocalization } from '../app/localization/backoffice-localization';
import { BackofficeAuthShell } from './backoffice-auth-shell';
import { useBackofficeAuth } from './backoffice-auth-context';
import { PasswordRecoveryUnavailableError, usePasswordRecovery } from './password-recovery';

type RecoveryState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'sent' }
  | { kind: 'failed'; reason: 'required' | 'unavailable' | 'failed' };

const backToLoginClassName =
  'inline-flex items-center gap-1.5 rounded-[var(--radius-control)] text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]';

export function BackofficePasswordRecoveryPage() {
  const bootstrap = useDeploymentBootstrap();
  const { status } = useBackofficeAuth();
  const recovery = usePasswordRecovery();
  const navigate = useNavigate();
  const { copy, t } = useBackofficeLocalization();
  const hasTrustedWorkspace = Boolean(resolveBootstrapWorkspace(bootstrap));
  const [identifier, setIdentifier] = useState('');
  const [state, setState] = useState<RecoveryState>({ kind: 'idle' });

  if (status === 'hydrating') return null;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  const isSubmitting = state.kind === 'submitting';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !hasTrustedWorkspace) return;
    if (!identifier.trim()) {
      setState({ kind: 'failed', reason: 'required' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      await recovery.request({ identifier: identifier.trim() });
      setState({ kind: 'sent' });
    } catch (failure) {
      setState({
        kind: 'failed',
        reason: failure instanceof PasswordRecoveryUnavailableError ? 'unavailable' : 'failed',
      });
    }
  };

  if (state.kind === 'sent') {
    return (
      <BackofficeAuthShell>
        <div aria-live="polite">
          <span className="grid size-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-surface))] text-[var(--color-success)]">
            <MessageCircle className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-bold leading-8 tracking-[-0.02em] text-[var(--color-text)]">
            {t('passwordRecoverySentTitle')}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
            {t('passwordRecoverySentDescription')}
          </p>
          <DButton size="lg" fullWidth className="mt-7" onClick={() => void navigate('/login')}>
            {t('backToSignIn')}
          </DButton>
        </div>
      </BackofficeAuthShell>
    );
  }

  const errorMessage =
    state.kind === 'failed'
      ? {
          required: t('passwordRecoveryIdentifierRequired'),
          unavailable: t('passwordRecoveryUnavailable'),
          failed: t('passwordRecoveryFailed'),
        }[state.reason]
      : null;

  return (
    <BackofficeAuthShell>
      <Link to="/login" className={backToLoginClassName}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('backToSignIn')}
      </Link>
      <h1 className="mt-5 text-2xl font-bold leading-8 tracking-[-0.02em] text-[var(--color-text)]">
        {t('forgotPassword')}
      </h1>
      <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-muted)]">
        {t('passwordRecoveryDescription')}
      </p>

      <form className="mt-7" onSubmit={submit} noValidate>
        {hasTrustedWorkspace ? null : (
          <DAlert variant="warning" className="mb-4">
            {t('signInWorkspaceUnavailable')}
          </DAlert>
        )}
        <DInput
          id="backoffice-recovery-identifier"
          name="username"
          label={t('usernameOrPhone')}
          value={identifier}
          onChange={(value) => {
            setIdentifier(value);
            if (state.kind === 'failed') setState({ kind: 'idle' });
          }}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          disabled={isSubmitting}
          placeholder={copy('Enter your username or phone number')}
        />
        {errorMessage ? (
          <DAlert
            variant={
              state.kind === 'failed' && state.reason === 'unavailable' ? 'warning' : 'danger'
            }
            role="alert"
            className="mt-4"
          >
            {errorMessage}
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
          {isSubmitting ? t('passwordRecoverySending') : t('passwordRecoverySubmit')}
        </DButton>
      </form>
    </BackofficeAuthShell>
  );
}
