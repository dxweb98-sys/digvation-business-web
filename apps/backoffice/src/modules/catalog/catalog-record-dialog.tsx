import { DDialog, DInput, DSelect, useToast } from '@digvation/ui';
import { useState } from 'react';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type { NamedRecord } from './catalog-api';
import { useCatalogLocalization } from './catalog-localization';
import { DialogFooter } from './catalog-shared';

export function CatalogNamedRecordDialog({
  entity,
  item,
  onClose,
  onSave,
  onSaved,
}: {
  entity: 'Category' | 'Variant';
  item: NamedRecord | null | undefined;
  onClose: () => void;
  onSave: (
    item: NamedRecord | null,
    input: { code?: string; name: string; status: 'ACTIVE' | 'INACTIVE' },
  ) => Promise<unknown>;
  onSaved: () => void;
}) {
  const fresh = item === null;
  const { showToast } = useToast();
  const { copy } = useCatalogLocalization();
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [status, setStatus] = useState(item?.status ?? 'ACTIVE');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(item ?? null, {
        ...(code.trim() ? { code: code.trim().toUpperCase() } : {}),
        name: name.trim(),
        status,
      });
      onSaved();
      showToast({
        variant: 'success',
        title: fresh ? copy(`${entity} added.`) : copy(`${entity} updated.`),
      });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(
            error,
            copy(`Could not save ${entity.toLowerCase()}.`),
          ).safeMessage,
        });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open={item !== undefined}
      onClose={onClose}
      title={`${fresh ? copy('Add') : copy('Edit')} ${copy(entity)}`}
      footer={
        <DialogFooter
          onClose={onClose}
          onSave={() => void save()}
          disabled={!name.trim() || saving}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DInput
          label={copy('Code')}
          hint={
            fresh
              ? copy('Leave blank to generate a code automatically.')
              : copy('Code cannot be changed after creation.')
          }
          value={code}
          onChange={setCode}
          disabled={!fresh}
        />
        <DInput
          label={copy('Name')}
          value={name}
          onChange={setName}
          placeholder={copy('For example, Coffee Latte')}
        />
        <DSelect
          label={copy('Status')}
          value={status}
          onChange={(value) => setStatus(value as 'ACTIVE' | 'INACTIVE')}
          options={[
            { label: copy('Active'), value: 'ACTIVE' },
            { label: copy('Inactive'), value: 'INACTIVE' },
          ]}
        />
      </div>
    </DDialog>
  );
}
