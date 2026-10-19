import { DDialog, DInput, DToggle, useToast } from '@digvation/ui';
import { Info } from 'lucide-react';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import { RecordDialogFooter, RecordDialogTitle } from '../../../shared/ui/record-dialog';
import type { BusinessSettingsApi, BusinessTaxConfiguration } from '../api/business-settings-api';
import { useBusinessLocalization } from '../localization/use-business-localization';
import {
  isValidTaxPercentage,
  percentageFromTaxRate,
  taxRateFromPercentage,
} from '../model/business-tax-rate';
import { BusinessFormPanel } from './business-section-layout';

/** Edits tax status and rate; Runtime applies them to future transactions only. */
export function BusinessTaxDialog({
  tax,
  api,
  onClose,
  onSaved,
}: {
  tax: BusinessTaxConfiguration;
  api: Pick<BusinessSettingsApi, 'updateTax'>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { copy } = useBusinessLocalization();
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(tax.enabled);
  const [percent, setPercent] = useState(() => percentageFromTaxRate(tax.rate));
  const [saving, setSaving] = useState(false);
  const validPercent = isValidTaxPercentage(percent);

  const close = () => {
    if (!saving) onClose();
  };
  const save = async () => {
    if (!validPercent || saving) return;
    setSaving(true);
    try {
      await api.updateTax(tax, { enabled, rate: taxRateFromPercentage(percent) });
      onSaved();
      onClose();
      showToast({ variant: 'success', title: copy('Tax configuration updated.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update tax configuration.'))
            .safeMessage,
        });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open
      onClose={close}
      title={<RecordDialogTitle title={copy('Edit tax')} />}
      footer={
        <RecordDialogFooter
          onClose={close}
          onSave={() => void save()}
          disabled={!validPercent}
          saving={saving}
        />
      }
    >
      <BusinessFormPanel>
        <div className="grid items-start gap-4 @sm:grid-cols-2">
          <DInput
            label={copy('Tax percentage')}
            inputMode="decimal"
            value={percent}
            onChange={setPercent}
            placeholder="11"
            suffix="%"
            disabled={saving}
            error={validPercent ? undefined : copy('Tax percentage must be between 0 and 100.')}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-(--color-text)">{copy('Transaction tax')}</p>
            <div className="mt-1.5 flex min-h-10 items-center justify-between gap-3 rounded-lg border border-(--color-border) px-3 py-2">
              <span className="min-w-0 text-sm text-(--color-text)">
                {copy(enabled ? 'Active' : 'Inactive')}
              </span>
              <DToggle
                checked={enabled}
                onChange={setEnabled}
                disabled={saving}
                ariaLabel={copy('Enable tax')}
              />
            </div>
          </div>
        </div>
        <p className="flex gap-2 text-xs text-(--color-text-muted)">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {copy('Enter a percentage from 0 to 100.')}{' '}
            {copy('Applies to new transactions. Finalized transactions do not change.')}
          </span>
        </p>
      </BusinessFormPanel>
    </DDialog>
  );
}
