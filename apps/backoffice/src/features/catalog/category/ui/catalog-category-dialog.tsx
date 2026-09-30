import { DBadge, DDialog, DInput, DSelect, useToast } from '@digvation/ui';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../../auth/backoffice-auth-context';
import { useFormState } from '../../../../shared/forms/use-form-state';
import type { CatalogApi, Category } from '../../api/catalog-api';
import { useCatalogLocalization } from '../../localization/use-catalog-localization';
import { CatalogPanel, DialogFooter, Status } from '../../ui/catalog-shared';
import {
  createCatalogCategoryEditorForm,
  toCreateCatalogCategoryInput,
  toUpdateCatalogCategoryInput,
  validateCatalogCategoryEditorForm,
  type CatalogCategoryStatus,
} from '../model/catalog-category-editor-form';

export function CatalogCategoryDialog({
  category,
  api,
  onClose,
  onSaved,
}: {
  /** `null` creates a category, `undefined` keeps the dialog closed. */
  category: Category | null | undefined;
  api: Pick<CatalogApi, 'createCategory' | 'updateCategory'>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fresh = category === null;
  const { showToast } = useToast();
  const { copy } = useCatalogLocalization();
  const form = useFormState(() => createCatalogCategoryEditorForm(category));
  const { code, name, status } = form.values;
  const [saving, setSaving] = useState(false);
  // Runtime owns code uniqueness and the tenant's generated-code pattern; show its answer inline.
  const [codeRejection, setCodeRejection] = useState<string | null>(null);
  const validation = validateCatalogCategoryEditorForm(form.values, { fresh });
  const codeIssueMessage =
    validation.code === 'CODE_REQUIRED'
      ? copy('Enter a category code.')
      : validation.code === 'CODE_INVALID'
        ? copy(
            'Use letters, numbers, dot, underscore, or hyphen, starting with a letter or number.',
          )
        : codeRejection;

  const save = async () => {
    if (!validation.valid || saving) return;
    setSaving(true);
    try {
      if (category) await api.updateCategory(category, toUpdateCatalogCategoryInput(form.values));
      else await api.createCategory(toCreateCatalogCategoryInput(form.values));
      onSaved();
      showToast({
        variant: 'success',
        title: fresh ? copy('Category added.') : copy('Category updated.'),
      });
      onClose();
    } catch (error) {
      if (isSessionExpiredError(error)) return;
      const failure = normalizeBackofficeApiError(error, copy('Could not save category.'));
      if (failure.code === 'DUPLICATE_RESOURCE')
        setCodeRejection(copy('Another category already uses this code.'));
      else if (failure.code === 'DOMAIN_VALIDATION_ERROR')
        setCodeRejection(
          copy('This code format is reserved for automatic codes. Use another code.'),
        );
      else showToast({ variant: 'danger', title: failure.safeMessage });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open={category !== undefined}
      onClose={onClose}
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--color-brand)]" aria-hidden="true" />
          <span>{fresh ? copy('Add category') : copy('Edit category')}</span>
          {category ? (
            <>
              <DBadge variant="info">{category.code}</DBadge>
              <Status value={category.status} />
            </>
          ) : null}
        </div>
      }
      footer={
        <DialogFooter
          onClose={onClose}
          onSave={() => void save()}
          disabled={!validation.valid || Boolean(codeRejection) || saving}
        />
      }
    >
      <CatalogPanel className="p-5" ariaLabel={copy('Category information')}>
        <div className="space-y-3">
          <DInput
            label={copy('Category name')}
            value={name}
            onChange={(value) => form.setField('name', value)}
            placeholder={copy('For example, Beverages')}
            error={
              validation.name === 'NAME_TOO_LONG'
                ? copy('Category name must be 160 characters or fewer.')
                : undefined
            }
            disabled={saving}
          />

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <DInput
              label={copy('Category code')}
              value={code}
              onChange={(value) => {
                setCodeRejection(null);
                form.setField('code', value);
              }}
              disabled={saving}
              error={codeIssueMessage ?? undefined}
              hint={
                fresh
                  ? copy('Leave blank to generate a code automatically.')
                  : copy('Letters, numbers, dot, underscore, or hyphen.')
              }
            />

            <DSelect
              label={copy('Status')}
              value={status}
              onChange={(value) => form.setField('status', value as CatalogCategoryStatus)}
              disabled={saving}
              options={[
                { label: copy('Active'), value: 'ACTIVE' },
                { label: copy('Inactive'), value: 'INACTIVE' },
              ]}
            />
          </div>
        </div>
      </CatalogPanel>
    </DDialog>
  );
}
