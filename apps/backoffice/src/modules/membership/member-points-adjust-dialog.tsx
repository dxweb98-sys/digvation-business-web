import { DButton, DDialog, DInfoNote, DInput, DSelect, DTextarea, useToast } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { readStoredBackofficeLocale } from '../../app/localization/backoffice-localization';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import { memberQueryKeys } from './member-detail-dialog';
import { formatImportPoints } from './member-import-model';
import {
  adjustmentAmountForRequest,
  previewAdjustment,
  sanitizePointsInput,
  type AdjustmentDirection,
} from './member-points-model';
import type { Member, MembersApi } from './members-api';
import { membershipCopy } from './membership-copy';
import { MemberDialogTitle, MemberNumberBadge, MemberPanel } from './membership-surfaces';

const REASON_MAX_LENGTH = 500;

/**
 * Manual point adjustment. It never edits the balance: Runtime appends a MANUAL_ADJUSTMENT
 * ledger entry carrying this reason and the signed-in operator, and rejects a subtraction that
 * would make the balance negative. The preview below is only a convenience.
 */
export function MemberPointsAdjustDialog({
  member,
  api,
  onAdjusted,
  onClose,
}: {
  member: Pick<Member, 'id' | 'memberNumber' | 'customer'>;
  api: Pick<MembersApi, 'balance' | 'adjustPoints'>;
  onAdjusted: () => void;
  onClose: () => void;
}) {
  const copy = membershipCopy();
  const locale = readStoredBackofficeLocale();
  const { showToast } = useToast();
  const balance = useQuery({
    queryKey: memberQueryKeys.balance(member.id),
    queryFn: () => api.balance(member.id),
  });
  const [direction, setDirection] = useState<AdjustmentDirection>('ADD');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const preview = balance.data
    ? previewAdjustment(balance.data.pointsBalance, amount, direction)
    : null;
  const amountTyped = amount.trim() !== '';
  const amountInvalid = amountTyped && adjustmentAmountForRequest(amount) === null;
  const canSave =
    !!preview && !preview.wouldBeNegative && reason.trim() !== '' && !busy && !!balance.data;
  const format = (value: string, signed = false) =>
    `${signed && !value.startsWith('-') ? '+' : ''}${formatImportPoints(value, locale)}`;

  const save = async () => {
    const points = adjustmentAmountForRequest(amount);
    if (!canSave || !points) return;
    setBusy(true);
    try {
      await api.adjustPoints(member.id, { direction, points, reason: reason.trim() });
      onAdjusted();
      showToast({ variant: 'success', title: copy.adjustSaved });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({ variant: 'danger', title: normalizeBackofficeApiError(error).safeMessage });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DDialog
      open
      onClose={busy ? () => undefined : onClose}
      size="md"
      title={
        <MemberDialogTitle
          title={copy.adjustPoints}
          badges={<MemberNumberBadge memberNumber={member.memberNumber} />}
        />
      }
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" disabled={busy} onClick={onClose}>
            {copy.cancel}
          </DButton>
          <DButton disabled={!canSave} onClick={() => void save()}>
            {copy.adjustSubmit}
          </DButton>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm font-semibold text-[var(--color-text)]">{member.customer.name}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <DSelect
            label={copy.adjustType}
            value={direction}
            options={[
              { value: 'ADD', label: copy.adjustAdd },
              { value: 'SUBTRACT', label: copy.adjustSubtract },
            ]}
            onChange={(value) => setDirection(value as AdjustmentDirection)}
          />
          <DInput
            label={copy.adjustAmount}
            value={amount}
            onChange={(value) => setAmount(sanitizePointsInput(value))}
            inputMode="decimal"
            placeholder={copy.adjustAmountPlaceholder}
            error={amountInvalid ? copy.adjustAmountInvalid : undefined}
          />
        </div>
        <DTextarea
          label={copy.adjustReason}
          value={reason}
          onChange={(value) => setReason(value.slice(0, REASON_MAX_LENGTH))}
          placeholder={copy.adjustReasonPlaceholder}
        />

        <MemberPanel className="p-4" ariaLabel={copy.adjustResult}>
          {balance.data ? (
            <dl className="space-y-1.5 text-sm tabular-nums">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--color-text-muted)]">{copy.adjustCurrent}</dt>
                <dd className="font-medium">{format(balance.data.pointsBalance)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--color-text-muted)]">{copy.adjustAdjustment}</dt>
                <dd className="font-medium">{preview ? format(preview.adjustment, true) : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-1.5">
                <dt className="font-semibold">{copy.adjustResult}</dt>
                <dd
                  className={`text-base font-semibold ${
                    preview?.wouldBeNegative ? 'text-[var(--color-danger)]' : ''
                  }`}
                >
                  {preview ? format(preview.result) : '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm italic text-[var(--color-text-muted)]">
              {copy.adjustLoadingBalance}
            </p>
          )}
        </MemberPanel>

        {preview?.wouldBeNegative ? (
          <p role="alert" className="text-xs leading-5 text-[var(--color-danger)]">
            {copy.adjustNegative}
          </p>
        ) : null}
        <DInfoNote variant="info">{copy.adjustAppendOnly}</DInfoNote>
      </div>
    </DDialog>
  );
}
