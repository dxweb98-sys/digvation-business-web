import { DBadge, DButton, DConfirmDialog, useToast } from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import { RecordPanel, RecordSectionLabel } from '../../../shared/ui/record-dialog';
import type {
  AccessControlApi,
  PasswordResetChallenge,
  PasswordResetStatus,
} from '../access-control-api';

export const passwordResetsKey = (userId: string) =>
  ['access-control', 'password-resets', userId] as const;

const statusBadge: Record<
  PasswordResetStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' | 'info' }
> = {
  PENDING: { label: 'Waiting for the user', variant: 'warning' },
  DELIVERY_FAILED: { label: 'Not delivered', variant: 'danger' },
  EXPIRED: { label: 'Expired', variant: 'secondary' },
  COMPLETED: { label: 'Password set', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'secondary' },
  SUPERSEDED: { label: 'Replaced', variant: 'secondary' },
  CLOSED: { label: 'Closed', variant: 'secondary' },
};

/**
 * Password link history for one user: when each link was requested and by whom, how it ended, and
 * the actions that still make sense (cancel a pending link). Sending a new link lives in the
 * Security panel above and replaces whatever is pending. Links and tokens are never shown.
 */
export function SecurityActivityPanel({
  userId,
  api,
  canCancel,
}: {
  userId: string;
  api: Pick<AccessControlApi, 'listPasswordResets' | 'cancelPasswordReset'>;
  canCancel: boolean;
}) {
  const { copy, formatDate } = useBackofficeLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState<PasswordResetChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const history = useQuery({
    queryKey: passwordResetsKey(userId),
    queryFn: () => api.listPasswordResets(userId),
  });

  const when = (value: string) =>
    formatDate(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });

  const cancel = async () => {
    if (!cancelling || busy) return;
    setBusy(true);
    try {
      await api.cancelPasswordReset(userId, cancelling.id);
      await queryClient.invalidateQueries({ queryKey: passwordResetsKey(userId) });
      showToast({ variant: 'success', title: copy('Password link cancelled.') });
      setCancelling(null);
    } catch (error) {
      if (isSessionExpiredError(error)) return;
      const failure = normalizeBackofficeApiError(
        error,
        copy('Could not cancel the password link.'),
      );
      setCancelling(null);
      await queryClient.invalidateQueries({ queryKey: passwordResetsKey(userId) });
      showToast({
        variant: 'danger',
        title:
          failure.code === 'PASSWORD_RESET_NOT_PENDING'
            ? copy('This link is no longer pending.')
            : failure.safeMessage,
      });
    } finally {
      setBusy(false);
    }
  };

  const items = history.data ?? [];
  const actionable = (item: PasswordResetChallenge) =>
    canCancel && (item.status === 'PENDING' || item.status === 'DELIVERY_FAILED');

  return (
    <RecordPanel>
      <RecordSectionLabel>{copy('Security activity')}</RecordSectionLabel>
      {history.isError ? (
        <p role="alert" className="mt-3 text-xs text-[var(--color-danger)]">
          {copy('Could not load password link history.')}
        </p>
      ) : history.isLoading ? (
        <p role="status" className="mt-3 text-xs text-[var(--color-text-muted)]">
          {copy('Loading...')}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
          {copy('No password links have been requested for this user.')}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-border)] rounded-[var(--radius-control)] border border-[var(--color-border)]">
          {items.map((item) => {
            const badge = statusBadge[item.status];
            const requester =
              item.requestedVia === 'ADMIN'
                ? `${copy('Requested by')} ${item.requestedBy ?? copy('an administrator')}`
                : item.requestedVia === 'SELF'
                  ? copy('Requested by the user')
                  : item.requestedVia === 'PUBLIC'
                    ? copy('Requested from the sign-in page')
                    : copy('Requester not recorded');
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DBadge variant={badge.variant}>{copy(badge.label)}</DBadge>
                    <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                      {when(item.requestedAt)}
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-[var(--color-text-muted)]">{requester}</p>
                  <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                    {item.status === 'COMPLETED' && item.completedAt
                      ? `${copy('Password set on')} ${when(item.completedAt)}`
                      : item.status === 'CANCELLED' && item.cancelledAt
                        ? `${copy('Cancelled on')} ${when(item.cancelledAt)}${
                            item.cancelledBy ? ` ${copy('by')} ${item.cancelledBy}` : ''
                          }`
                        : item.status === 'SUPERSEDED'
                          ? copy('Replaced by a newer link.')
                          : item.status === 'CLOSED'
                            ? copy('Closed before outcomes were recorded.')
                            : item.status === 'EXPIRED'
                              ? `${copy('Expired on')} ${when(item.expiresAt)}`
                              : item.status === 'DELIVERY_FAILED'
                                ? copy(
                                    'The message provider did not accept this link. Send a new one.',
                                  )
                                : `${copy('Valid until')} ${when(item.expiresAt)}`}
                  </p>
                </div>
                {actionable(item) ? (
                  <DButton size="sm" variant="ghost" onClick={() => setCancelling(item)}>
                    {copy('Cancel link')}
                  </DButton>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
        {copy('Provider acceptance is not proof that the user read the message.')}
      </p>
      <DConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => (busy ? undefined : setCancelling(null))}
        onConfirm={() => void cancel()}
        loading={busy}
        title={copy('Cancel this password link?')}
        message={copy('The link stops working immediately. The user keeps their current password.')}
        confirmLabel={copy('Cancel link')}
        cancelLabel={copy('Keep link')}
        variant="danger"
      />
    </RecordPanel>
  );
}
