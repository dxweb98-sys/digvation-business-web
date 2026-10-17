import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { DAlert, DButton, DDialog, DInput } from '@digvation/ui';
import { KeyRound, MessageCircle } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { useBackofficeLocalization } from '../app/localization/backoffice-localization';
import { RecordDialogTitle } from '../shared/ui/record-dialog';
import { useBackofficeAuth } from './backoffice-auth-context';
import {
  changeOwnPassword,
  PasswordChangeError,
  PasswordLinkRequestError,
  requestOwnPasswordLink,
} from './http-password-change.adapter';

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

type Mode = 'current' | 'link';
type LinkState =
  | { kind: 'idle' | 'pending' | 'sent' }
  | { kind: 'failed'; reason: 'cooldown' | 'unavailable' | 'failed' };
type ChangeState =
  | { kind: 'idle' | 'pending' | 'changed' }
  | { kind: 'failed'; reason: 'policy' | 'throttled' | 'session' | 'failed' };

/**
 * Account-menu password management. Two separate mechanisms, never mixed in one request:
 *  - "current": the user proves the current password and chooses a new one. On success the Runtime
 *    ends every session (this one too), so the dialog finishes with a sign-in prompt.
 *  - "link": for a forgotten password, a one-time link is submitted to the WhatsApp provider for the
 *    number on the account; the password is set on the reset page. "Sent" here only means the
 *    provider accepted the submission, never that the message arrived.
 */
export function BackofficePasswordLinkDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const bootstrap = useDeploymentBootstrap();
  const { getAccessToken, logout } = useBackofficeAuth();
  const { t } = useBackofficeLocalization();
  const [mode, setMode] = useState<Mode>('current');
  const [link, setLink] = useState<LinkState>({ kind: 'idle' });
  const [change, setChange] = useState<ChangeState>({ kind: 'idle' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [incorrect, setIncorrect] = useState(false);
  const [touched, setTouched] = useState(false);

  // The dialog surface takes focus on open; move it to the first field so typing can start at once.
  useEffect(() => {
    if (!open || mode !== 'current') return;
    const frame = window.requestAnimationFrame(() =>
      document.getElementById('backoffice-current-password')?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [open, mode]);

  const reset = () => {
    setMode('current');
    setLink({ kind: 'idle' });
    setChange({ kind: 'idle' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
    setIncorrect(false);
    setTouched(false);
  };
  const close = () => {
    const finished = change.kind === 'changed';
    reset();
    onClose();
    // The Runtime already revoked every session; leave the app on the sign-in screen.
    if (finished) void logout();
  };

  const newLength = [...newPassword].length;
  const newValid = newLength >= PASSWORD_MIN && newLength <= PASSWORD_MAX;
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;
  const newError = !touched
    ? undefined
    : !newValid
      ? t('activationPasswordTooShort')
      : sameAsCurrent
        ? t('newPasswordSameAsCurrent')
        : undefined;
  const confirmError =
    (touched || confirmation.length > 0) && confirmation !== newPassword
      ? t('activationPasswordMismatch')
      : undefined;
  const formValid =
    currentPassword.length > 0 && newValid && !sameAsCurrent && confirmation === newPassword;

  const submitChange = async (event: FormEvent) => {
    event.preventDefault();
    if (change.kind === 'pending') return;
    setTouched(true);
    if (!formValid) return;
    setIncorrect(false);
    setChange({ kind: 'pending' });
    try {
      await changeOwnPassword({
        apiBaseUrl: bootstrap.apiBaseUrl,
        getAccessToken,
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setChange({ kind: 'changed' });
    } catch (failure) {
      const reason = failure instanceof PasswordChangeError ? failure.reason : 'failed';
      if (reason === 'incorrect') {
        setIncorrect(true);
        setChange({ kind: 'idle' });
      } else {
        setChange({ kind: 'failed', reason });
      }
    }
  };

  const sendLink = async () => {
    if (link.kind === 'pending') return;
    setLink({ kind: 'pending' });
    try {
      await requestOwnPasswordLink({ apiBaseUrl: bootstrap.apiBaseUrl, getAccessToken });
      setLink({ kind: 'sent' });
    } catch (failure) {
      setLink({
        kind: 'failed',
        reason: failure instanceof PasswordLinkRequestError ? failure.reason : 'failed',
      });
    }
  };

  const linkFailure = {
    cooldown: t('passwordLinkCooldown'),
    unavailable: t('passwordLinkUnavailable'),
    failed: t('passwordLinkFailed'),
  } as const;
  const changeFailure = {
    policy: t('activationPasswordTooShort'),
    throttled: t('changePasswordThrottled'),
    session: t('changePasswordSessionExpired'),
    failed: t('changePasswordFailed'),
  } as const;

  const changed = change.kind === 'changed';
  const pending = change.kind === 'pending';

  return (
    <DDialog
      open={open}
      onClose={pending ? () => undefined : close}
      title={<RecordDialogTitle title={t('changePassword')} />}
      size="md"
      footer={
        mode === 'current' ? (
          <div className="flex justify-end gap-2">
            {changed ? (
              <DButton onClick={close}>{t('changePasswordSignIn')}</DButton>
            ) : (
              <>
                <DButton variant="secondary" onClick={close} disabled={pending}>
                  {t('passwordLinkCancel')}
                </DButton>
                <DButton
                  type="submit"
                  form="backoffice-change-password-form"
                  loading={pending}
                  disabled={pending}
                >
                  {t('changePasswordSubmit')}
                </DButton>
              </>
            )}
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={close}>
              {link.kind === 'sent' ? t('passwordLinkDone') : t('passwordLinkCancel')}
            </DButton>
            {link.kind === 'sent' ? null : (
              <DButton loading={link.kind === 'pending'} onClick={() => void sendLink()}>
                {t('passwordLinkSend')}
              </DButton>
            )}
          </div>
        )
      }
    >
      {mode === 'current' ? (
        <form
          id="backoffice-change-password-form"
          className="space-y-4"
          onSubmit={(event) => void submitChange(event)}
          noValidate
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <KeyRound className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {t('changePasswordHeading')}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
                {t('changePasswordDescription')}
              </p>
            </div>
          </div>
          {changed ? (
            <DAlert variant="success" role="status">
              {t('changePasswordDone')}
            </DAlert>
          ) : (
            <>
              <DInput
                id="backoffice-current-password"
                name="current-password"
                label={t('currentPasswordLabel')}
                type="password"
                value={currentPassword}
                onChange={(value) => {
                  setCurrentPassword(value);
                  setIncorrect(false);
                }}
                autoComplete="current-password"
                error={incorrect ? t('currentPasswordIncorrect') : undefined}
                disabled={pending}
                autoFocus
              />
              <DInput
                id="backoffice-new-password"
                name="new-password"
                label={t('activationNewPassword')}
                type="password"
                value={newPassword}
                onChange={(value) => setNewPassword(value)}
                onBlur={() => setTouched(true)}
                autoComplete="new-password"
                hint={t('activationPasswordHint')}
                error={newError}
                disabled={pending}
              />
              <DInput
                id="backoffice-confirm-new-password"
                name="confirm-password"
                label={t('activationConfirmPassword')}
                type="password"
                value={confirmation}
                onChange={(value) => setConfirmation(value)}
                onBlur={() => setTouched(true)}
                autoComplete="new-password"
                error={confirmError}
                disabled={pending}
              />
              {change.kind === 'failed' ? (
                <DAlert variant="danger" role="alert">
                  {changeFailure[change.reason]}
                </DAlert>
              ) : null}
              <div className="border-t border-[var(--color-border)] pt-3">
                <DButton
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={pending}
                  onClick={() => setMode('link')}
                >
                  {t('passwordLinkSwitch')}
                </DButton>
              </div>
            </>
          )}
        </form>
      ) : (
        <div className="space-y-4" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <MessageCircle className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {t('passwordLinkHeading')}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
                {t('passwordLinkDescription')}
              </p>
            </div>
          </div>
          {link.kind === 'sent' ? (
            <DAlert variant="success">
              <span className="flex items-start gap-2">
                <MessageCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{t('passwordLinkSent')}</span>
              </span>
            </DAlert>
          ) : null}
          {link.kind === 'failed' ? (
            <DAlert variant={link.reason === 'cooldown' ? 'warning' : 'danger'} role="alert">
              {linkFailure[link.reason]}
            </DAlert>
          ) : null}
          <div className="border-t border-[var(--color-border)] pt-3">
            <DButton variant="ghost" size="sm" type="button" onClick={() => setMode('current')}>
              {t('passwordLinkBack')}
            </DButton>
          </div>
        </div>
      )}
    </DDialog>
  );
}
