import { DCurrencyInput, DDatePicker, DDialog, DSelect, DTextarea, useToast } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import { useFormState } from '../../../shared/forms/use-form-state';
import {
  RecordDialogFooter,
  RecordDialogTitle,
  RecordPanel,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import type { Expense, ExpenseApi } from '../api/expense-api';
import { useExpensesLocalization } from '../localization/use-expenses-localization';
import {
  createExpenseEditorForm,
  toExpenseInput,
  validateExpenseEditorForm,
} from '../model/expense-editor-form';
import { expenseCategoryOptions, isExpenseSourceAccountType } from '../model/expense-model';
import { ExpenseStatusBadge } from './expense-presentation';

export const expenseEditorKeys = {
  locations: ['expense-locations'] as const,
  accounts: ['expense-accounts'] as const,
};

/** Keeps the saved value selectable when it is no longer offered (e.g. a deactivated account). */
function withCurrentOption(
  options: { value: string; label: string }[],
  current: { value: string; label: string } | null,
) {
  if (!current || options.some((option) => option.value === current.value)) return options;
  return [current, ...options];
}

export function ExpenseDialog({
  expense,
  api,
  onClose,
  onSaved,
}: {
  /** `null` records an expense, `undefined` keeps the dialog closed. */
  expense: Expense | null | undefined;
  api: Pick<ExpenseApi, 'create' | 'update' | 'listLocations' | 'listSourceAccounts'>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = expense !== undefined;
  const fresh = expense === null;
  const { copy, labels } = useExpensesLocalization();
  const { showToast } = useToast();
  const form = useFormState(() => createExpenseEditorForm(expense));
  const { sellingLocationId, financialAccountId, categoryCode, amount, note, occurredAt } =
    form.values;
  const [saving, setSaving] = useState(false);
  const validation = validateExpenseEditorForm(form.values);

  const locations = useQuery({
    queryKey: expenseEditorKeys.locations,
    queryFn: () => api.listLocations(),
    enabled: open,
  });
  const accounts = useQuery({
    queryKey: expenseEditorKeys.accounts,
    queryFn: () => api.listSourceAccounts(),
    enabled: open,
  });

  const locationOptions = withCurrentOption(
    (locations.data?.items ?? [])
      .filter((location) => location.status === 'ACTIVE')
      .map((location) => ({ value: location.id, label: location.name })),
    expense ? { value: expense.sellingLocationId, label: expense.sellingLocationName } : null,
  );
  const accountOptions = withCurrentOption(
    (accounts.data?.items ?? [])
      .filter((account) => account.status === 'ACTIVE' && isExpenseSourceAccountType(account.type))
      .map((account) => ({ value: account.id, label: account.name })),
    expense ? { value: expense.financialAccountId, label: expense.financialAccountName } : null,
  );

  const save = async () => {
    if (!validation.valid || saving) return;
    setSaving(true);
    try {
      const input = toExpenseInput(form.values);
      if (expense) await api.update(expense, input);
      else await api.create(input);
      onSaved();
      onClose();
      showToast({
        variant: 'success',
        title: copy(fresh ? 'Expense recorded.' : 'Expense updated.'),
      });
    } catch (error) {
      if (isSessionExpiredError(error)) return;
      const failure = normalizeBackofficeApiError(error, copy('Could not save expense.'));
      showToast({
        variant: failure.code === 'VERSION_CONFLICT' ? 'warning' : 'danger',
        title: copy(failure.safeMessage),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <RecordDialogTitle title={copy(fresh ? 'Record expense' : 'Edit expense')}>
          {expense ? <ExpenseStatusBadge status={expense.status} /> : null}
        </RecordDialogTitle>
      }
      footer={
        <RecordDialogFooter
          onClose={onClose}
          onSave={() => void save()}
          disabled={!validation.valid || saving}
          saving={saving}
        />
      }
    >
      <div className="space-y-4">
        <RecordPanel ariaLabel={copy('Expense context')}>
          <RecordSectionLabel>{copy('Expense context')}</RecordSectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DSelect
              label={copy('Selling location')}
              value={sellingLocationId}
              placeholder={copy('Select selling location')}
              options={locationOptions}
              loading={locations.isLoading}
              disabled={saving}
              onChange={(value) => form.setField('sellingLocationId', String(value ?? ''))}
            />
            <DDatePicker
              label={copy('Date')}
              value={occurredAt}
              onChange={(value) => form.setField('occurredAt', value)}
              placeholder={copy('Select expense date')}
              disabled={saving}
            />
          </div>
        </RecordPanel>

        <RecordPanel ariaLabel={copy('Payment source')}>
          <RecordSectionLabel>{copy('Payment source')}</RecordSectionLabel>
          <div className="mt-4 space-y-3">
            <DSelect
              label={copy('Source financial account')}
              value={financialAccountId}
              placeholder={copy('Select source financial account')}
              options={accountOptions}
              loading={accounts.isLoading}
              disabled={saving}
              onChange={(value) => form.setField('financialAccountId', String(value ?? ''))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <DSelect
                label={copy('Category')}
                value={categoryCode}
                placeholder={copy('Select expense category')}
                options={expenseCategoryOptions(labels, expense?.categoryCode)}
                disabled={saving}
                onChange={(value) => form.setField('categoryCode', String(value ?? ''))}
              />
              <DCurrencyInput
                label={copy('Amount')}
                value={amount}
                onValueChange={(value) => form.setField('amount', value)}
                placeholder={copy('For example, 150000')}
                disabled={saving}
              />
            </div>
          </div>
        </RecordPanel>

        <RecordPanel ariaLabel={copy('Description')}>
          <DTextarea
            label={`${copy('Description')} ${copy('(optional)')}`}
            value={note}
            onChange={(value) => form.setField('note', value)}
            placeholder={copy('For example, Operational supplies purchase')}
            disabled={saving}
          />
        </RecordPanel>
      </div>
    </DDialog>
  );
}
