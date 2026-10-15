import { DButton, DInput } from '@digvation/ui';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useBackofficeLocalization } from '../app/localization/backoffice-localization';
import { BackofficeAuthShell } from './backoffice-auth-shell';
import { PASSWORD_RECOVERY_PATH } from './backoffice-login-page';
import {
  PasswordResetError,
  usePasswordRecovery,
  type PasswordResetReference,
} from './password-recovery';

export const PASSWORD_RESET_PATH = '/reset-password';

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const WORKSPACE_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageState =
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'rejected'; reason: 'invalid' | 'expired' }
  | { kind: 'network' };

/** Reads workspace/challenge from the query and the one-time token from the URL fragment. */
function readReference(search: string, hash: string): PasswordResetReference | null {
  const query = new URLSearchParams(search);
  const workspace = query.get('workspace')?.trim().toLowerCase() ?? '';
  const challengeId = query.get('challenge')?.trim() ?? '';
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? '';
  if (!WORKSPACE_PATTERN.test(workspace) || !UUID_PATTERN.test(challengeId)) return null;
  if (!TOKEN_PATTERN.test(token)) return null;
  return { workspace, challengeId, token };
}

const iconClassName =
  'grid size-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-surface))] text-[var(--color-success)]';
const warningClassName =
  'grid size-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-warning)_14%,var(--color-surface))] text-[var(--color-warning)]';
const titleClassName =
  'mt-5 text-2xl font-bold leading-8 tracking-[-0.02em] text-[var(--color-text)]';
const descriptionClassName = 'mt-2 text-sm leading-6 text-[var(--color-text-muted)]';

/**
 * Completes WhatsApp password recovery from a one-time link. The credential is read once from the
 * URL fragment into memory, removed from the address bar, and sent only in the POST body.
 */
export function BackofficePasswordResetPage() {
  const recovery = usePasswordRecovery();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useBackofficeLocalization();
  const [reference, setReference] = useState(() => readReference(location.search, location.hash));
  const [state, setState] = useState<PageState>(() =>
    reference ? { kind: 'ready' } : { kind: 'rejected', reason: 'invalid' },
  );
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [touched, setTouched] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (window.location.hash)
      window.history.replaceState(null, '', `${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  // Re-opening the link in this same tab only changes the fragment (no page load).
  useEffect(() => {
    const onHashChange = () => {
      const next = readReference(window.location.search, window.location.hash);
      if (!next) return;
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      setPassword('');
      setConfirmation('');
      setTouched(false);
      setReference(next);
      setState({ kind: 'ready' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const length = [...password].length;
  const lengthValid = length >= PASSWORD_MIN && length <= PASSWORD_MAX;
  const formValid = lengthValid && confirmation === password;
  const passwordError = touched && !lengthValid ? t('activationPasswordTooShort') : undefined;
  const confirmationError =
    (touched || confirmation.length > 0) && confirmation !== password
      ? t('activationPasswordMismatch')
      : undefined;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const link = reference;
    if (!link || state.kind === 'submitting' || submitting.current) return;
    setTouched(true);
    if (!formValid) return;
    submitting.current = true;
    setState({ kind: 'submitting' });
    try {
      await recovery.confirm({ ...link, newPassword: password });
      setReference(null);
      setPassword('');
      setConfirmation('');
      setState({ kind: 'done' });
    } catch (failure) {
      const reason = failure instanceof PasswordResetError ? failure.reason : 'network';
      if (reason === 'expired') setState({ kind: 'rejected', reason: 'expired' });
      else if (reason === 'invalid') setState({ kind: 'rejected', reason: 'invalid' });
      else setState({ kind: 'network' });
    } finally {
      submitting.current = false;
    }
  };

  if (state.kind === 'done')
    return (
      <BackofficeAuthShell>
        <div aria-live="polite">
          <span className={iconClassName}>
            <CircleCheck className="size-5" aria-hidden="true" />
          </span>
          <h1 className={titleClassName}>{t('resetDoneTitle')}</h1>
          <p className={descriptionClassName}>{t('resetDoneDescription')}</p>
          <DButton size="lg" fullWidth className="mt-7" onClick={() => void navigate('/login')}>
            {t('activationGoToSignIn')}
          </DButton>
        </div>
      </BackofficeAuthShell>
    );

  if (state.kind === 'rejected' || state.kind === 'network') {
    const [title, description] =
      state.kind === 'network'
        ? [t('activationNetworkTitle'), t('activationNetworkDescription')]
        : state.reason === 'expired'
          ? [t('resetExpiredTitle'), t('resetExpiredDescription')]
          : [t('resetInvalidTitle'), t('resetInvalidDescription')];
    return (
      <BackofficeAuthShell>
        <div role="alert">
          <span className={warningClassName}>
            <CircleAlert className="size-5" aria-hidden="true" />
          </span>
          <h1 className={titleClassName}>{title}</h1>
          <p className={descriptionClassName}>{description}</p>
          {state.kind === 'network' && reference ? (
            <DButton
              size="lg"
              fullWidth
              className="mt-7"
              onClick={() => setState({ kind: 'ready' })}
            >
              {t('activationRetry')}
            </DButton>
          ) : (
            <DButton
              size="lg"
              fullWidth
              className="mt-7"
              onClick={() => void navigate(PASSWORD_RECOVERY_PATH)}
            >
              {t('resetRequestNewLink')}
            </DButton>
          )}
        </div>
      </BackofficeAuthShell>
    );
  }

  const isSubmitting = state.kind === 'submitting';
  return (
    <BackofficeAuthShell>
      <h1 className="text-2xl font-bold leading-8 tracking-[-0.02em] text-[var(--color-text)]">
        {t('resetTitle')}
      </h1>
      <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-muted)]">
        {t('resetDescription')}
      </p>
      <form className="mt-6" onSubmit={submit} noValidate>
        <div className="space-y-4">
          <DInput
            id="backoffice-reset-password"
            name="new-password"
            label={t('activationNewPassword')}
            type="password"
            value={password}
            onChange={(value) => setPassword(value)}
            onBlur={() => setTouched(true)}
            autoComplete="new-password"
            hint={t('activationPasswordHint')}
            error={passwordError}
            disabled={isSubmitting}
            autoFocus
          />
          <DInput
            id="backoffice-reset-confirmation"
            name="confirm-password"
            label={t('activationConfirmPassword')}
            type="password"
            value={confirmation}
            onChange={(value) => setConfirmation(value)}
            onBlur={() => setTouched(true)}
            autoComplete="new-password"
            error={confirmationError}
            disabled={isSubmitting}
          />
        </div>
        <DButton
          type="submit"
          size="lg"
          fullWidth
          className="mt-6"
          loading={isSubmitting}
          disabled={!formValid || isSubmitting}
        >
          {isSubmitting ? t('resetSubmitting') : t('resetSubmit')}
        </DButton>
      </form>
    </BackofficeAuthShell>
  );
}
