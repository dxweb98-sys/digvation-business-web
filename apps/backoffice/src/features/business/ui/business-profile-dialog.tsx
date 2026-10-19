import { DDialog, DInput, useToast } from '@digvation/ui';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import { RecordDialogFooter, RecordDialogTitle } from '../../../shared/ui/record-dialog';
import type { BusinessProfile, BusinessSettingsApi } from '../api/business-settings-api';
import { useBusinessLocalization } from '../localization/use-business-localization';
import { BusinessFormPanel } from './business-section-layout';

/** Edits the business name through the Business Profile command, at the profile's version. */
export function BusinessProfileDialog({
  profile,
  api,
  onClose,
  onSaved,
}: {
  profile: BusinessProfile;
  api: Pick<BusinessSettingsApi, 'updateProfile'>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { copy } = useBusinessLocalization();
  const { showToast } = useToast();
  const [name, setName] = useState(profile.name ?? '');
  const [saving, setSaving] = useState(false);
  const missingName = !name.trim();

  const close = () => {
    if (!saving) onClose();
  };
  const save = async () => {
    if (missingName || saving) return;
    setSaving(true);
    try {
      await api.updateProfile(profile, name.trim());
      onSaved();
      onClose();
      showToast({ variant: 'success', title: copy('Business information updated.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update business information.'))
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
      title={<RecordDialogTitle title={copy('Edit business information')} />}
      footer={
        <RecordDialogFooter
          onClose={close}
          onSave={() => void save()}
          disabled={missingName}
          saving={saving}
        />
      }
    >
      <BusinessFormPanel>
        <DInput
          label={copy('Business name')}
          value={name}
          onChange={setName}
          placeholder={copy('e.g. Salon Maju')}
          disabled={saving}
          autoFocus
          hint={copy('The business name shown in Backoffice and Operational.')}
          error={missingName ? copy('Enter a business name.') : undefined}
        />
      </BusinessFormPanel>
    </DDialog>
  );
}
