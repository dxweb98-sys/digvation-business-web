import { DBadge, DCheckbox, DDialog, DInput, DTextarea, useToast } from '@digvation/ui';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import { RecordDialogFooter, RecordDialogTitle } from '../../../shared/ui/record-dialog';
import type { BusinessSettingsApi, SellingLocation } from '../api/business-settings-api';
import { useBusinessLocalization } from '../localization/use-business-localization';
import { BusinessFormPanel } from './business-section-layout';

export function BusinessLocationDialog({
  location,
  items,
  api,
  onClose,
  onChanged,
}: {
  /** `null` creates a location, `undefined` keeps the dialog closed. */
  location: SellingLocation | null | undefined;
  items: SellingLocation[];
  api: Pick<BusinessSettingsApi, 'createLocation' | 'updateLocation'>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy } = useBusinessLocalization();
  const { showToast } = useToast();
  const isNew = location === null;
  const [code, setCode] = useState('');
  const [name, setName] = useState(location?.name ?? '');
  const [address, setAddress] = useState(location?.address ?? '');
  const [main, setMain] = useState(
    Boolean(location?.isMain) || (location === null && items.length === 0),
  );
  // Required-field messages appear once a field has been touched, not on an untouched form.
  const [touched, setTouched] = useState({ code: false, name: false });
  const [saving, setSaving] = useState(false);
  const missingCode = isNew && !code.trim();
  const missingName = !name.trim();
  const valid = !missingName && !missingCode;

  const close = () => {
    if (!saving) onClose();
  };
  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      if (isNew)
        await api.createLocation({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          setAsMain: main || undefined,
          address: address.trim(),
        });
      else if (location)
        await api.updateLocation(location, {
          name: name.trim(),
          setAsMain: main && !location.isMain ? true : undefined,
          address: address.trim(),
        });
      onChanged();
      onClose();
      showToast({
        variant: 'success',
        title: copy(isNew ? 'Selling location added.' : 'Selling location updated.'),
      });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not save selling location.'))
            .safeMessage,
        });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open={location !== undefined}
      onClose={close}
      title={
        <RecordDialogTitle title={copy(isNew ? 'Add selling location' : 'Edit selling location')}>
          {location ? (
            <>
              <DBadge variant="info">{location.code}</DBadge>
              {location.isMain ? <DBadge variant="secondary">{copy('Main branch')}</DBadge> : null}
              {location.status !== 'ACTIVE' ? (
                <DBadge variant="secondary">{copy('Inactive')}</DBadge>
              ) : null}
            </>
          ) : null}
        </RecordDialogTitle>
      }
      footer={
        <RecordDialogFooter
          onClose={close}
          onSave={() => void save()}
          disabled={!valid}
          saving={saving}
          saveLabel={copy('Save location')}
        />
      }
    >
      <BusinessFormPanel>
        <div className="grid items-start gap-4 @sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <DInput
            label={copy('Location name')}
            value={name}
            onChange={(value) => {
              setName(value);
              setTouched((state) => ({ ...state, name: true }));
            }}
            placeholder={copy('Branch name, e.g. Salon BSD')}
            disabled={saving}
            autoFocus
            error={touched.name && missingName ? copy('Enter a location name.') : undefined}
          />
          {isNew ? (
            <DInput
              label={copy('Location code')}
              value={code}
              onChange={(value) => {
                setCode(value.toUpperCase());
                setTouched((state) => ({ ...state, code: true }));
              }}
              placeholder={copy('e.g. BSD')}
              disabled={saving}
              error={touched.code && missingCode ? copy('Enter a location code.') : undefined}
            />
          ) : (
            <DInput
              label={copy('Location code')}
              value={location?.code ?? ''}
              onChange={() => undefined}
              disabled
            />
          )}
        </div>
        <p className="-mt-2 text-xs text-(--color-text-muted)">
          {copy('The code is set only when the location is created.')}
        </p>
        <DTextarea
          label={`${copy('Location address')} ${copy('(optional)')}`}
          value={address}
          onChange={setAddress}
          placeholder={copy('Street, area, city')}
          disabled={saving}
          rows={2}
        />
        <label className="flex items-start gap-3 text-sm">
          <DCheckbox
            checked={main}
            onChange={() => setMain((value) => !value)}
            disabled={Boolean(location?.isMain) || saving}
          />
          <span className="min-w-0">
            <span className="block font-medium text-(--color-text)">
              {copy('Use as main branch')}
            </span>
            <span className="mt-0.5 block text-xs text-(--color-text-muted)">
              {copy(
                location?.isMain
                  ? 'This location is the main branch. To change it, make another location the main branch.'
                  : 'The default location for business operations.',
              )}
            </span>
          </span>
        </label>
      </BusinessFormPanel>
    </DDialog>
  );
}
