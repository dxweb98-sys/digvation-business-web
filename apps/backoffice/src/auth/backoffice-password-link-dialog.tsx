import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { DAlert, DButton, DDialog } from '@digvation/ui';
import { Mail } from 'lucide-react';
import { useState } from 'react';

import { useBackofficeLocalization } from '../app/localization/backoffice-localization';
import { RecordDialogTitle } from '../shared/ui/record-dialog';
import { useBackofficeAuth } from './backoffice-auth-context';
import { PasswordLinkRequestError, requestOwnPasswordLink } from './http-password-change.adapter';

type LinkState =
  | { kind: 'idle' | 'pending' | 'sent' }
  | { kind: 'failed'; reason: 'cooldown' | 'unavailable' | 'failed' };

/** Passwords are set only on the single-use email-link page, never inside an authenticated shell. */
export function BackofficePasswordLinkDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const bootstrap = useDeploymentBootstrap();
  const { getAccessToken } = useBackofficeAuth();
  const { t } = useBackofficeLocalization();
  const [state, setState] = useState<LinkState>({ kind: 'idle' });
  const request = async () => {
    if (state.kind === 'pending') return;
    setState({ kind: 'pending' });
    try {
      await requestOwnPasswordLink({ apiBaseUrl: bootstrap.apiBaseUrl, getAccessToken });
      setState({ kind: 'sent' });
    } catch (error) {
      setState({
        kind: 'failed',
        reason: error instanceof PasswordLinkRequestError ? error.reason : 'failed',
      });
    }
  };
  const failure =
    state.kind === 'failed'
      ? {
          cooldown: t('passwordLinkCooldown'),
          unavailable: t('passwordLinkUnavailable'),
          failed: t('passwordLinkFailed'),
        }[state.reason]
      : null;
  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={<RecordDialogTitle title={t('changePassword')} />}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {t('passwordLinkCancel')}
          </DButton>
          {state.kind === 'sent' ? null : (
            <DButton loading={state.kind === 'pending'} onClick={() => void request()}>
              {t('passwordLinkSend')}
            </DButton>
          )}
        </div>
      }
    >
      <div className="space-y-4" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            <Mail className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {t('passwordLinkHeading')}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
              {t('passwordLinkDescription')}
            </p>
          </div>
        </div>
        {state.kind === 'sent' ? (
          <DAlert variant="success" role="status">
            {t('passwordLinkSent')}
          </DAlert>
        ) : null}
        {failure ? (
          <DAlert
            variant={state.kind === 'failed' && state.reason === 'cooldown' ? 'warning' : 'danger'}
            role="alert"
          >
            {failure}
          </DAlert>
        ) : null}
      </div>
    </DDialog>
  );
}
