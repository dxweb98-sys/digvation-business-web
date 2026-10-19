import { DBadge, DDialog, DInput, useToast } from '@digvation/ui';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import { RecordDialogFooter, RecordDialogTitle } from '../../../shared/ui/record-dialog';
import type { BusinessSettingsApi, NumberingPreference } from '../api/business-settings-api';
import { useBusinessLocalization } from '../localization/use-business-localization';
import { isValidNumberingPadding, isValidNumberingPrefix } from '../model/business-numbering';
import { BusinessFormPanel } from './business-section-layout';

/**
 * Edits one namespace's prefix and padding. Runtime owns the sequence: the current number is
 * shown read-only, and no next code is predicted because some namespaces add a date segment.
 */
export function BusinessNumberingDialog({
  preference,
  label,
  api,
  onClose,
  onChanged,
}: {
  preference: NumberingPreference;
  label: string;
  api: Pick<BusinessSettingsApi, 'updateNumbering'>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy } = useBusinessLocalization();
  const { showToast } = useToast();
  const [prefix, setPrefix] = useState(preference.prefix);
  const [padding, setPadding] = useState(String(preference.padding));
  const [saving, setSaving] = useState(false);
  const validPrefix = isValidNumberingPrefix(prefix);
  const validPadding = isValidNumberingPadding(padding);

  const close = () => {
    if (!saving) onClose();
  };
  const save = async () => {
    if (!validPrefix || !validPadding || saving) return;
    setSaving(true);
    try {
      await api.updateNumbering(preference, { prefix, padding: Number(padding) });
      onChanged();
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update numbering.'))
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
      title={
        <RecordDialogTitle title={copy('Edit numbering')}>
          <DBadge variant="info">{label}</DBadge>
        </RecordDialogTitle>
      }
      footer={
        <RecordDialogFooter
          onClose={close}
          onSave={() => void save()}
          disabled={!validPrefix || !validPadding}
          saving={saving}
        />
      }
    >
      <BusinessFormPanel>
        <div className="grid items-start gap-4 @sm:grid-cols-2">
          <DInput
            label={copy('Prefix')}
            value={prefix}
            onChange={(value) => setPrefix(value.toUpperCase())}
            placeholder="PRD"
            disabled={saving}
            autoFocus
            hint={copy('Uppercase letters, numbers, - or _, up to 16 characters.')}
            error={
              validPrefix
                ? undefined
                : copy('Uppercase letters, numbers, - or _, up to 16 characters.')
            }
          />
          <DInput
            label={copy('Padding')}
            inputMode="numeric"
            value={padding}
            onChange={setPadding}
            placeholder="6"
            disabled={saving}
            hint={copy('A whole number from 1 to 12.')}
            error={validPadding ? undefined : copy('A whole number from 1 to 12.')}
          />
        </div>
        <div
          role="group"
          aria-label={copy('Current sequence')}
          className="flex items-center justify-between gap-4 rounded-lg bg-(--color-surface-muted) px-3 py-2.5 text-sm"
        >
          <div className="min-w-0">
            <p className="font-medium text-(--color-text)">{copy('Current sequence')}</p>
            <p className="mt-0.5 text-xs text-(--color-text-muted)">
              {copy('Read-only. Changes apply to codes generated after you save.')}
            </p>
          </div>
          <span className="font-mono text-base font-semibold tabular-nums text-(--color-text)">
            {preference.currentSequence}
          </span>
        </div>
      </BusinessFormPanel>
    </DDialog>
  );
}
