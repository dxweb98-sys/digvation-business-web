import { DAlert, DButton, DInput, DSpinner } from '@digvation/ui';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useBackofficeLocalization } from '../app/localization/backoffice-localization';
import {
  AccountActivationError,
  useAccountActivation,
  type ActivationLinkReference,
  type ActivationLinkStatus,
} from './account-activation';
import { BackofficeAuthShell } from './backoffice-auth-shell';

export const ACCOUNT_ACTIVATION_PATH = '/activate';

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const WORKSPACE_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageState =
  | { kind: 'checking' }
  | { kind: 'ready'; businessName: string }
  | { kind: 'rejected'; status: Exclude<ActivationLinkStatus, 'VALID'> }
  | { kind: 'network' }
  | { kind: 'incomplete' }
  | { kind: 'submitting'; businessName: string }
  | { kind: 'done' };

/** Reads workspace/invitation from the query and the one-time token from the URL fragment. */
function readReference(search: string, hash: string): ActivationLinkReference | null {
  const query = new URLSearchParams(search);
  const workspace = query.get('workspace')?.trim().toLowerCase() ?? '';
  const invitationId = query.get('invitation')?.trim() ?? '';
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? '';
  if (!WORKSPACE_PATTERN.test(workspace) || !UUID_PATTERN.test(invitationId)) return null;
  if (!TOKEN_PATTERN.test(token)) return null;
  return { workspace, invitationId, token };
}

/** Keeps the page from leaking the link through Referer while it is mounted. */
function useNoReferrer() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

const stateIconClassName =
  'grid size-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-surface))] text-[var(--color-success)]';
const warningIconClassName =
  'grid size-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-warning)_14%,var(--color-surface))] text-[var(--color-warning)]';
const titleClassName =
  'mt-5 text-2xl font-bold leading-8 tracking-[-0.02em] text-[var(--color-text)]';
const descriptionClassName = 'mt-2 text-sm leading-6 text-[var(--color-text-muted)]';

export function BackofficeAccountActivationPage() {
  const activation = useAccountActivation();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useBackofficeLocalization();
  useNoReferrer();

  // The credential is captured once into memory, then removed from the address bar and history.
  const [reference, setReference] = useState(() => readReference(location.search, location.hash));
  const [state, setState] = useState<PageState>(() =>
    reference ? { kind: 'checking' } : { kind: 'incomplete' },
  );
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [touched, setTouched] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const submitting = useRef(false);

  useEffect(() => {
    if (window.location.hash)
      window.history.replaceState(null, '', `${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  // Re-opening the invitation link in this same tab only changes the fragment (no page load).
  useEffect(() => {
    const onHashChange = () => {
      const next = readReference(window.location.search, window.location.hash);
      if (!next) return;
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      setPassword('');
      setConfirmation('');
      setTouched(false);
      setReference(next);
      setState({ kind: 'checking' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const link = reference;
    if (!link) return;
    let cancelled = false;
    activation
      .inspect(link)
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'VALID' && result.businessName)
          setState({ kind: 'ready', businessName: result.businessName });
        else
          setState({
            kind: 'rejected',
            status: result.status === 'VALID' ? 'INVALID' : result.status,
          });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'network' });
      });
    return () => {
      cancelled = true;
    };
  }, [activation, attempt, reference]);

  const length = [...password].length;
  const passwordError =
    touched && (length < PASSWORD_MIN || length > PASSWORD_MAX)
      ? t('activationPasswordTooShort')
      : undefined;
  const confirmationError =
    (touched || confirmation.length > 0) && confirmation !== password
      ? t('activationPasswordMismatch')
      : undefined;
  const formValid = length >= PASSWORD_MIN && length <= PASSWORD_MAX && confirmation === password;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const link = reference;
    if (state.kind !== 'ready' || !link || submitting.current) return;
    setTouched(true);
    if (!formValid) return;
    submitting.current = true;
    setState({ kind: 'submitting', businessName: state.businessName });
    try {
      await activation.activate({ ...link, password });
      setReference(null);
      setPassword('');
      setConfirmation('');
      setState({ kind: 'done' });
    } catch (failure) {
      const reason = failure instanceof AccountActivationError ? failure.reason : 'network';
      if (reason === 'expired') setState({ kind: 'rejected', status: 'EXPIRED' });
      else if (reason === 'used') setState({ kind: 'rejected', status: 'USED' });
      else if (reason === 'revoked') setState({ kind: 'rejected', status: 'REVOKED' });
      else if (reason === 'invalid') setState({ kind: 'rejected', status: 'INVALID' });
      else setState({ kind: 'network' });
    } finally {
      submitting.current = false;
    }
  };

  if (state.kind === 'checking')
    return (
      <BackofficeAuthShell>
        <div className="flex items-center gap-3" role="status" aria-live="polite">
          <DSpinner size="sm" />
          <p className="text-sm text-[var(--color-text-muted)]">{t('activationChecking')}</p>
        </div>
      </BackofficeAuthShell>
    );

  if (state.kind === 'done')
    return (
      <BackofficeAuthShell>
        <div aria-live="polite">
          <span className={stateIconClassName}>
            <CircleCheck className="size-5" aria-hidden="true" />
          </span>
          <h1 className={titleClassName}>{t('activationDoneTitle')}</h1>
          <p className={descriptionClassName}>{t('activationDoneDescription')}</p>
          <DButton size="lg" fullWidth className="mt-7" onClick={() => void navigate('/login')}>
            {t('activationGoToSignIn')}
          </DButton>
        </div>
      </BackofficeAuthShell>
    );

  if (state.kind === 'incomplete')
    return (
      <BackofficeAuthShell>
        <div role="alert">
          <span className={warningIconClassName}>
            <CircleAlert className="size-5" aria-hidden="true" />
          </span>
          <h1 className={titleClassName}>{t('activationIncompleteTitle')}</h1>
          <p className={descriptionClassName}>{t('activationIncompleteDescription')}</p>
          <DButton
            size="lg"
            fullWidth
            variant="secondary"
            className="mt-7"
            onClick={() => void navigate('/login')}
          >
            {t('activationGoToSignIn')}
          </DButton>
        </div>
      </BackofficeAuthShell>
    );

  if (state.kind === 'rejected' || state.kind === 'network') {
    const copyByState = {
      INVALID: [t('activationInvalidTitle'), t('activationInvalidDescription')],
      EXPIRED: [t('activationExpiredTitle'), t('activationExpiredDescription')],
      USED: [t('activationUsedTitle'), t('activationUsedDescription')],
      REVOKED: [t('activationRevokedTitle'), t('activationRevokedDescription')],
    } as const;
    const [title, description] =
      state.kind === 'network'
        ? [t('activationNetworkTitle'), t('activationNetworkDescription')]
        : copyByState[state.status];
    return (
      <BackofficeAuthShell>
        <div role="alert">
          <span className={warningIconClassName}>
            <CircleAlert className="size-5" aria-hidden="true" />
          </span>
          <h1 className={titleClassName}>{title}</h1>
          <p className={descriptionClassName}>{description}</p>
          {state.kind === 'network' && reference ? (
            <DButton
              size="lg"
              fullWidth
              className="mt-7"
              onClick={() => {
                submitting.current = false;
                setState({ kind: 'checking' });
                setAttempt((value) => value + 1);
              }}
            >
              {t('activationRetry')}
            </DButton>
          ) : (
            <DButton
              size="lg"
              fullWidth
              variant="secondary"
              className="mt-7"
              onClick={() => void navigate('/login')}
            >
              {t('activationGoToSignIn')}
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
        {t('activationTitle')}
      </h1>
      <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-muted)]">
        {t('activationDescription')}
      </p>
      <DAlert variant="info" className="mt-5">
        <span className="font-medium">{t('activationBusiness')}:</span> {state.businessName}
      </DAlert>

      <form className="mt-6" onSubmit={submit} noValidate>
        <div className="space-y-4">
          <DInput
            id="backoffice-activation-password"
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
            id="backoffice-activation-confirmation"
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
          {isSubmitting ? t('activationSubmitting') : t('activationSubmit')}
        </DButton>
      </form>
    </BackofficeAuthShell>
  );
}
