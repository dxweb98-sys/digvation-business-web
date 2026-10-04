import { DButton, DDialog, DInfoNote, DTextarea } from '@digvation/ui';
import { useState } from 'react';

import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';

/** Reversal is its own command; it never refunds payments on the operator's behalf. */
export function TransactionReverseDialog({
  open,
  onClose,
  onReverse,
}: {
  open: boolean;
  onClose: () => void;
  /** Resolves `null` on success, else the message to show. */
  onReverse: (reason: string) => Promise<string | null>;
}) {
  const { copy } = useTransactionHistoryLocalization();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason.trim() || saving) return;
    setSaving(true);
    setError(await onReverse(reason.trim()));
    setSaving(false);
  };

  return (
    <DDialog
      open={open}
      onClose={() => !saving && onClose()}
      title={copy('Reverse transaction')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose} disabled={saving}>
            {copy('Cancel')}
          </DButton>
          <DButton
            variant="danger"
            onClick={() => void submit()}
            disabled={!reason.trim() || saving}
            loading={saving}
          >
            {copy('Reverse transaction')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-3">
        <DInfoNote variant="warning">
          {copy(
            'All successful payments must be fully refunded before this transaction can be reversed.',
          )}
        </DInfoNote>
        <DTextarea
          label={copy('Reason')}
          value={reason}
          onChange={(value) => {
            setReason(value);
            setError(null);
          }}
          placeholder={copy('For example, Customer returned the item')}
          error={error ?? undefined}
          disabled={saving}
        />
      </div>
    </DDialog>
  );
}
