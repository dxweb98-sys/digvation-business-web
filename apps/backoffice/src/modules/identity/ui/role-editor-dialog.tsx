import { DBadge, DConfirmDialog, DDialog, DInput, DButton, useToast } from '@digvation/ui';
import { useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import {
  RecordDialogFooter,
  RecordDialogTitle,
  RecordPanel,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import type { AccessControlApi, AccessPermission, AccessRole } from '../access-control-api';
import {
  configurableKeys,
  permissionCategories,
  sameSelection,
  selectedIn,
} from '../model/permission-navigation';
import { ROLE_CODE_PATTERN, roleCodeFromName } from '../model/role-code';
import { PermissionNavigator } from './permission-navigator';

/**
 * Create a role or manage one. System roles are immutable: they show a concise summary of what
 * they grant, with the full permission list one click away (read only). Editable roles use the
 * category navigator and warn before unsaved changes are discarded.
 */
export function RoleEditorDialog({
  role,
  permissions,
  api,
  canUpdate,
  canManagePermissions,
  onClose,
  onChanged,
}: {
  /** `null` creates a role. */
  role: AccessRole | null;
  permissions: AccessPermission[];
  api: AccessControlApi;
  canUpdate: boolean;
  canManagePermissions: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy, locale } = useBackofficeLocalization();
  const { showToast } = useToast();

  const isNew = role === null;
  const isSystemRole = Boolean(role?.systemKey);
  const [code, setCode] = useState('');
  const [editingCode, setEditingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [name, setName] = useState(role?.name ?? '');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const canEditName = !isSystemRole && (isNew || canUpdate);
  const canEditPermissions = !isSystemRole && (isNew || canManagePermissions);
  const canSave = isNew || (!isSystemRole && (canUpdate || canManagePermissions));

  // The Runtime requires a code: use the one typed under advanced editing, else derive it.
  const effectiveCode = code.trim().toUpperCase() || roleCodeFromName(name);
  const codeInvalid =
    isNew && (!ROLE_CODE_PATTERN.test(effectiveCode) || effectiveCode === 'OWNER');

  const dirty =
    !isSystemRole &&
    (isNew
      ? Boolean(code.trim() || name.trim() || selected.length)
      : name !== (role?.name ?? '') || !sameSelection(selected, role?.permissions ?? []));
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectableCount = useMemo(() => configurableKeys(permissions).length, [permissions]);
  const selectedCount = useMemo(
    () => configurableKeys(permissions).filter((key) => selectedSet.has(key)).length,
    [permissions, selectedSet],
  );

  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  };

  const change = (keys: string[], checked: boolean) =>
    setSelected((values) => {
      const next = new Set(values);
      for (const key of keys) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      return [...next];
    });

  const save = async () => {
    if (!name.trim() || codeInvalid || isSystemRole || saving) {
      if (isNew && name.trim() && codeInvalid) {
        setEditingCode(true);
        setCodeError(
          copy(
            effectiveCode === 'OWNER'
              ? 'This code is reserved. Choose another role code.'
              : 'Use 1 to 64 letters, numbers, dot, underscore, or hyphen.',
          ),
        );
      }
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await api.createRole({
          code: effectiveCode,
          name: name.trim(),
          permissions: selected,
        });
      } else if (role) {
        let current = role;
        if (canUpdate && name.trim() !== role.name)
          current = await api.updateRole(role, name.trim());
        if (canManagePermissions && !sameSelection(selected, role.permissions))
          await api.replacePermissions(current, selected);
      }
      onChanged();
      onClose();
      showToast({ variant: 'success', title: copy('Role updated.') });
    } catch (error) {
      const failure = normalizeBackofficeApiError(error, copy('Could not save role.'));
      if (isNew && failure.code === 'DUPLICATE_RESOURCE') {
        setEditingCode(true);
        setCodeError(copy('A role with this code already exists. Change the code or the name.'));
      } else if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: failure.safeMessage,
        });
    } finally {
      setSaving(false);
    }
  };

  // Concise read-only overview of a system role: totals per experience, not a list of areas.
  const summary = useMemo(() => {
    const byExperience = new Map<
      string,
      { label: string; selected: number; total: number; areas: number }
    >();
    for (const category of permissionCategories(permissions, locale)) {
      const entry = byExperience.get(category.experience) ?? {
        label: category.experienceLabel,
        selected: 0,
        total: 0,
        areas: 0,
      };
      const count = selectedIn(category, selectedSet);
      entry.selected += count;
      entry.total += category.permissions.length;
      if (count > 0) entry.areas += 1;
      byExperience.set(category.experience, entry);
    }
    return [...byExperience.entries()].map(([key, value]) => ({ key, ...value }));
  }, [permissions, locale, selectedSet]);
  const fullAccess = selectableCount > 0 && selectedCount === selectableCount;

  return (
    <DDialog
      open
      onClose={requestClose}
      title={
        <RecordDialogTitle title={copy(isNew ? 'Create role' : 'Manage role')}>
          {role ? <DBadge variant="info">{role.code}</DBadge> : null}
          {isSystemRole ? <DBadge variant="secondary">{copy('System role')}</DBadge> : null}
        </RecordDialogTitle>
      }
      size="xl"
      footer={
        canSave ? (
          <RecordDialogFooter
            onClose={requestClose}
            onSave={() => void save()}
            saving={saving}
            disabled={!name.trim() || !dirty}
            saveLabel={copy('Save role')}
          />
        ) : (
          <div className="flex justify-end">
            <DButton variant="secondary" onClick={onClose}>
              {copy('Close')}
            </DButton>
          </div>
        )
      }
    >
      <div className="space-y-4">
        <RecordPanel>
          <div className="space-y-3">
            <DInput
              label={copy('Role name')}
              value={name}
              onChange={(value) => {
                setName(value);
                setCodeError(null);
              }}
              disabled={!canEditName || saving}
              placeholder={copy('For example, Store Manager')}
              autoFocus={isNew}
            />
            {isNew ? (
              editingCode ? (
                <div className="space-y-2">
                  <DInput
                    label={copy('Custom role code')}
                    value={code}
                    onChange={(value) => {
                      setCode(value.toUpperCase());
                      setCodeError(null);
                    }}
                    hint={copy(
                      'Letters, numbers, dot, underscore or hyphen. The code cannot be changed after the role is created.',
                    )}
                    error={codeError ?? undefined}
                    disabled={saving}
                  />
                  <DButton
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCode('');
                      setCodeError(null);
                      setEditingCode(false);
                    }}
                  >
                    {copy('Use generated code')}
                  </DButton>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <span>{copy('Role code preview')}</span>
                  <DBadge variant="secondary">{effectiveCode || '—'}</DBadge>
                  <DButton
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCode(effectiveCode);
                      setEditingCode(true);
                    }}
                  >
                    {copy('Edit code')}
                  </DButton>
                </div>
              )
            ) : null}
          </div>
          {isSystemRole ? (
            <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
              {copy('System roles have built-in permissions that cannot be changed.')}
            </p>
          ) : null}
        </RecordPanel>

        <RecordPanel>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <RecordSectionLabel>{copy('Permissions')}</RecordSectionLabel>
                <DBadge variant={selectedCount > 0 ? 'info' : 'secondary'}>
                  {selectedCount}/{selectableCount} {copy('distinct permissions selected')}
                </DBadge>
              </div>
              {!isSystemRole ? (
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  {copy(
                    'Choose an access area, then a category. Your selection is kept when you switch.',
                  )}
                </p>
              ) : null}
            </div>
            {isSystemRole ? (
              <DButton
                size="sm"
                variant="outline"
                aria-expanded={showDetails}
                onClick={() => setShowDetails((value) => !value)}
              >
                {copy(showDetails ? 'Hide permission details' : 'View permission details')}
              </DButton>
            ) : null}
          </div>

          {isSystemRole ? (
            <>
              <ul className="grid gap-3 sm:grid-cols-2" aria-label={copy('Permissions')}>
                {summary.map((item) => (
                  <li
                    key={item.key}
                    className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2.5"
                  >
                    <p className="text-xs text-[var(--color-text-muted)]">{item.label}</p>
                    <p className="text-sm font-semibold tabular-nums text-[var(--color-text)]">
                      {item.selected}/{item.total} {copy('permissions')}
                      <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                        {item.areas} {copy('categories')}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
                {copy(
                  'Some permissions apply to both Backoffice and Operational, so the per-area totals add up to more than the distinct total.',
                )}
              </p>
              {fullAccess ? (
                <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
                  {copy('Full access to every permission.')}
                </p>
              ) : null}
              {showDetails ? (
                <div className="mt-4">
                  <PermissionNavigator
                    permissions={permissions}
                    selected={selectedSet}
                    readOnly
                    onChange={change}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <PermissionNavigator
              permissions={permissions}
              selected={selectedSet}
              readOnly={!canEditPermissions || saving}
              onChange={change}
            />
          )}
        </RecordPanel>
      </div>

      <DConfirmDialog
        open={confirmingDiscard}
        onClose={() => setConfirmingDiscard(false)}
        onConfirm={onClose}
        title={copy('Discard changes?')}
        message={copy('You have unsaved changes to this role. Discard them?')}
        confirmLabel={copy('Discard')}
        cancelLabel={copy('Keep editing')}
        variant="danger"
      />
    </DDialog>
  );
}
