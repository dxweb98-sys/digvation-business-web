import { DDialog, DInput, DSelect, useToast } from '@digvation/ui';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import { RecordDialogFooter, RecordDialogTitle } from '../../../shared/ui/record-dialog';
import type { BusinessPreferences, BusinessSettingsApi } from '../api/business-settings-api';
import { useBusinessLocalization } from '../localization/use-business-localization';
import {
  DATE_FORMATS,
  TIME_FORMATS,
  dateFormatExample,
  timeFormatExample,
  timeFormatLabel,
} from '../model/business-preferences-format';
import { BusinessFormPanel } from './business-section-layout';

type PreferencesDraft = Omit<BusinessPreferences, 'version' | 'createdAt' | 'updatedAt'>;

/**
 * Edits language and date/time display through the Business Preferences command. The stored
 * values are loaded as they are; only the timezone is trimmed on save.
 */
export function BusinessLocalizationDialog({
  preferences,
  api,
  onClose,
  onSaved,
}: {
  preferences: BusinessPreferences;
  api: Pick<BusinessSettingsApi, 'updatePreferences'>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { copy } = useBusinessLocalization();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<PreferencesDraft>({
    defaultLocale: preferences.defaultLocale,
    timezone: preferences.timezone,
    dateFormat: preferences.dateFormat,
    timeFormat: preferences.timeFormat,
  });
  const [saving, setSaving] = useState(false);
  const missingTimezone = !draft.timezone.trim();

  const close = () => {
    if (!saving) onClose();
  };
  const save = async () => {
    if (missingTimezone || saving) return;
    setSaving(true);
    try {
      await api.updatePreferences(preferences, { ...draft, timezone: draft.timezone.trim() });
      onSaved();
      onClose();
      showToast({ variant: 'success', title: copy('Language & time updated.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update language & time.'))
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
      size="lg"
      title={<RecordDialogTitle title={copy('Edit language & time')} />}
      footer={
        <RecordDialogFooter
          onClose={close}
          onSave={() => void save()}
          disabled={missingTimezone}
          saving={saving}
        />
      }
    >
      <BusinessFormPanel>
        <div className="grid items-start gap-4 @sm:grid-cols-2">
          <DSelect
            label={copy('Default language')}
            value={draft.defaultLocale}
            clearable={false}
            disabled={saving}
            options={[
              { value: 'id-ID', label: copy('Indonesian') },
              { value: 'en-US', label: copy('English') },
            ]}
            onValueChange={(value) => {
              if (value === 'id-ID' || value === 'en-US')
                setDraft({ ...draft, defaultLocale: value });
            }}
          />
          <DInput
            label={copy('Timezone')}
            value={draft.timezone}
            onChange={(timezone) => setDraft({ ...draft, timezone })}
            placeholder="Asia/Jakarta"
            disabled={saving}
            hint={copy('IANA time zone, e.g. Asia/Jakarta.')}
            error={missingTimezone ? copy('Enter a time zone.') : undefined}
          />
          <DSelect
            label={copy('Date format')}
            value={draft.dateFormat}
            clearable={false}
            disabled={saving}
            options={DATE_FORMATS.map((value) => ({
              value,
              label: `${dateFormatExample(value)} (${value})`,
            }))}
            onValueChange={(value) => {
              const format = DATE_FORMATS.find((item) => item === value);
              if (format) setDraft({ ...draft, dateFormat: format });
            }}
          />
          <DSelect
            label={copy('Time format')}
            value={draft.timeFormat}
            clearable={false}
            disabled={saving}
            options={TIME_FORMATS.map((value) => ({
              value,
              label: timeFormatLabel(value, copy),
            }))}
            onValueChange={(value) => {
              const format = TIME_FORMATS.find((item) => item === value);
              if (format) setDraft({ ...draft, timeFormat: format });
            }}
          />
        </div>
        <p className="text-sm text-(--color-text-muted)">
          {copy('Preview')}:{' '}
          <span className="font-medium tabular-nums text-(--color-text)">
            {dateFormatExample(draft.dateFormat)} {timeFormatExample(draft.timeFormat)}
          </span>
        </p>
      </BusinessFormPanel>
    </DDialog>
  );
}
