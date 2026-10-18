import { DDialog, DInput, DSelect, useToast } from '@digvation/ui';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import { useFormState } from '../../../shared/forms/use-form-state';
import {
  RecordDialogFooter,
  RecordPanel,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import type {
  FinancialAccount,
  FinancialAccountsApi,
  FinancialAccountType,
} from '../api/financial-accounts-api';
import { useFinancialAccountsLocalization } from '../localization/use-financial-accounts-localization';
import {
  createFinancialAccountEditorForm,
  toCreateFinancialAccountInput,
  toUpdateFinancialAccountInput,
  validateFinancialAccountEditorForm,
} from '../model/financial-account-editor-form';
import {
  ACCOUNT_TYPE_LABELS,
  destinationFieldCopy,
  FINANCIAL_ACCOUNT_TYPES,
} from '../model/financial-account-model';
import { provisionDefaultCheckoutRoute } from '../model/payment-route-model';
import { FinancialDialogTitle } from './financial-accounts-shared';

export function FinancialAccountDialog({
  account,
  api,
  onClose,
  onSaved,
}: {
  /** `null` creates an account, `undefined` keeps the dialog closed. */
  account: FinancialAccount | null | undefined;
  api: Pick<
    FinancialAccountsApi,
    | 'createAccount'
    | 'updateAccount'
    | 'listLocations'
    | 'listRoutes'
    | 'createRoute'
    | 'updateRoute'
  >;
  onClose: () => void;
  onSaved: (account: FinancialAccount) => void;
}) {
  const fresh = account === null;
  const { copy } = useFinancialAccountsLocalization();
  const { showToast } = useToast();
  const form = useFormState(() => createFinancialAccountEditorForm(account));
  const { code, name, type, currency, institutionName, accountReference, accountHolderName } =
    form.values;
  const [saving, setSaving] = useState(false);
  // Runtime owns code uniqueness and the generated-code pattern; its answer is shown inline.
  const [codeRejection, setCodeRejection] = useState<string | null>(null);
  const validation = validateFinancialAccountEditorForm(form.values, { fresh });
  const destination = destinationFieldCopy(type);

  const save = async () => {
    if (!validation.valid || saving) return;
    setSaving(true);
    try {
      const saved = account
        ? await api.updateAccount(account, toUpdateFinancialAccountInput(form.values))
        : await api.createAccount(toCreateFinancialAccountInput(form.values));
      let checkoutProvisioned = false;
      try {
        checkoutProvisioned = await provisionDefaultCheckoutRoute(api, saved);
      } catch {
        checkoutProvisioned = false;
      }
      onSaved(saved);
      onClose();
      showToast({
        variant: 'success',
        title: copy(fresh ? 'Financial account added.' : 'Financial account updated.'),
      });
      if (!checkoutProvisioned && saved.status === 'ACTIVE')
        showToast({
          variant: 'warning',
          title: copy(
            'Configure payment routing if this account should be available in Operational checkout.',
          ),
        });
    } catch (error) {
      if (isSessionExpiredError(error)) return;
      const failure = normalizeBackofficeApiError(error, copy('Could not save financial account.'));
      if (fresh && failure.code === 'DUPLICATE_RESOURCE')
        setCodeRejection(copy('Another financial account already uses this code.'));
      else if (fresh && failure.code === 'DOMAIN_VALIDATION_ERROR' && code.trim())
        setCodeRejection(
          copy('This code format is reserved for automatic codes. Use another code.'),
        );
      else
        showToast({
          variant: failure.code === 'VERSION_CONFLICT' ? 'warning' : 'danger',
          title: copy(failure.safeMessage),
        });
    } finally {
      setSaving(false);
    }
  };

  const codeError =
    validation.code === 'CODE_INVALID'
      ? copy('Use letters, numbers, dot, underscore, or hyphen, starting with a letter or number.')
      : codeRejection;

  return (
    <DDialog
      open={account !== undefined}
      onClose={onClose}
      size="lg"
      title={
        <FinancialDialogTitle
          title={copy(fresh ? 'Add account' : 'Edit account')}
          {...(account ? { code: account.code, status: account.status } : {})}
        />
      }
      footer={
        <RecordDialogFooter
          onClose={onClose}
          onSave={() => void save()}
          disabled={!validation.valid || Boolean(codeRejection) || saving}
        />
      }
    >
      <div className="space-y-4">
        <RecordPanel ariaLabel={copy('Account identity')}>
          <RecordSectionLabel>{copy('Account identity')}</RecordSectionLabel>
          <div className="mt-4 space-y-3">
            <DInput
              label={copy('Account name')}
              value={name}
              onChange={(value) => form.setField('name', value)}
              placeholder={copy('For example, Main settlement account')}
              error={
                validation.name === 'NAME_TOO_LONG'
                  ? copy('Account name must be 160 characters or fewer.')
                  : undefined
              }
              disabled={saving}
              autoFocus
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <DInput
                label={copy('Account code')}
                value={code}
                onChange={(value) => {
                  setCodeRejection(null);
                  form.setField('code', value.toUpperCase());
                }}
                disabled={!fresh || saving}
                placeholder={fresh ? copy('Automatic') : copy('No code')}
                error={codeError ?? undefined}
                hint={
                  fresh
                    ? copy('Leave blank to generate a code automatically.')
                    : copy('Locked after creation.')
                }
              />
              <DSelect
                label={copy('Account type')}
                value={type}
                disabled={!fresh || saving}
                options={FINANCIAL_ACCOUNT_TYPES.map((value) => ({
                  value,
                  label: copy(ACCOUNT_TYPE_LABELS[value]),
                }))}
                onChange={(value) => value && form.setField('type', value as FinancialAccountType)}
                hint={fresh ? undefined : copy('Locked after creation.')}
              />
              <DInput
                label={copy('Currency')}
                value={currency}
                onChange={(value) => form.setField('currency', value.toUpperCase())}
                disabled={!fresh || saving}
                maxLength={3}
                placeholder="IDR"
                error={
                  validation.currency === 'CURRENCY_INVALID'
                    ? copy('Use a 3-letter currency code, for example IDR.')
                    : undefined
                }
                hint={fresh ? undefined : copy('Locked after creation.')}
              />
            </div>
          </div>
        </RecordPanel>

        <RecordPanel ariaLabel={copy('Destination details')}>
          <RecordSectionLabel>{copy('Destination details')}</RecordSectionLabel>
          {destination ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DInput
                label={copy(destination.institution)}
                value={institutionName}
                onChange={(value) => form.setField('institutionName', value)}
                placeholder={copy(destination.institutionPlaceholder)}
                disabled={saving}
              />
              <DInput
                label={copy(destination.reference)}
                value={accountReference}
                onChange={(value) => form.setField('accountReference', value)}
                placeholder={copy(destination.referencePlaceholder)}
                disabled={saving}
              />
              <DInput
                label={`${copy(destination.holder)} ${copy('(optional)')}`}
                value={accountHolderName}
                onChange={(value) => form.setField('accountHolderName', value)}
                placeholder={copy(destination.holderPlaceholder)}
                containerClassName="sm:col-span-2"
                disabled={saving}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              {copy('Cash is held on site. No bank or provider details are needed.')}
            </p>
          )}
        </RecordPanel>
      </div>
    </DDialog>
  );
}
