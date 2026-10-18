import { DButton, DDialog, DTextarea } from '@digvation/ui';
import { useState } from 'react';

import type { Expense } from '../api/expense-api';
import { useExpensesLocalization } from '../localization/use-expenses-localization';

export function ExpenseRejectDialog({
  expense,
  onClose,
  onReject,
}: {
  expense: Expense | null;
  onClose: () => void;
  /** Resolves once Runtime accepted the rejection; the dialog stays open on failure. */
  onReject: (expense: Expense, note: string) => Promise<boolean>;
}) {
  const { copy } = useExpensesLocalization();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const trimmed = note.trim();

  const reject = async () => {
    if (!expense || !trimmed || saving) return;
    setSaving(true);
    const rejected = await onReject(expense, trimmed);
    setSaving(false);
    if (rejected) onClose();
  };

  return (
    <DDialog
      open={Boolean(expense)}
      onClose={onClose}
      title={copy('Reject expense?')}
      description={copy('This expense will not be realized. A rejection note is required.')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose} disabled={saving}>
            {copy('Cancel')}
          </DButton>
          <DButton
            variant="danger"
            disabled={!trimmed || saving}
            loading={saving}
            onClick={() => void reject()}
          >
            {copy('Reject')}
          </DButton>
        </div>
      }
    >
      <DTextarea
        label={copy('Rejection note')}
        value={note}
        onChange={setNote}
        placeholder={copy('For example, Supporting receipt is incomplete')}
        disabled={saving}
      />
    </DDialog>
  );
}
