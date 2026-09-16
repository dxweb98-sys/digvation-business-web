import {
  DAccordion,
  DAccordionItem,
  DBadge,
  DButton,
  DCheckbox,
  DDataTable,
  DDialog,
  DInput,
  DSearchInput,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { Ban, UserCog } from 'lucide-react';
import { useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type { AccessControlApi, AccessPermission, AccessRole } from './access-control-api';
import { groupAccessPermissions } from './permission-catalog';

const protectedRoleCopy = {
  id: 'Peran sistem memiliki izin bawaan.',
  en: 'System roles have built-in permissions.',
} as const;

export function RolesTable({
  roles,
  loading,
  canEdit,
  canDeactivate,
  onEdit,
  onDeactivate,
}: {
  roles: AccessRole[];
  loading: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  onEdit: (role: AccessRole) => void;
  onDeactivate: (role: AccessRole) => void;
}) {
  const { copy } = useBackofficeLocalization();
  const columns: TableColumn<AccessRole>[] = [
    {
      key: 'name',
      label: copy('Role'),
      render: (role) => (
        <div>
          <p className="font-medium">{role.name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{role.code}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (role) => (
        <DBadge variant={role.status === 'ACTIVE' ? 'success' : 'secondary'}>
          {copy(role.status === 'ACTIVE' ? 'Active' : 'Inactive')}
        </DBadge>
      ),
    },
    {
      key: 'permissions',
      label: copy('Permissions'),
      render: (role) => String(role.permissions.length),
    },
  ];
  return (
    <DDataTable
      columns={columns}
      data={roles}
      loading={loading}
      rowKey="id"
      emptyMessage={copy('No roles have been configured yet.')}
      actions={[
        {
          label: copy('Manage roles'),
          icon: <UserCog className="size-4" />,
          onClick: onEdit,
          show: () => canEdit,
        },
        {
          label: copy('Deactivate'),
          icon: <Ban className="size-4" />,
          variant: 'danger',
          onClick: onDeactivate,
          show: (role) => canDeactivate && !role.systemKey && role.status === 'ACTIVE',
        },
      ]}
    />
  );
}

export function RoleEditor({
  role,
  permissions,
  api,
  canUpdate,
  canManagePermissions,
  onClose,
  onChanged,
}: {
  role: AccessRole | null | undefined;
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
  const [name, setName] = useState(role?.name ?? '');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const canEditName = !isSystemRole && (isNew || canUpdate);
  const canEditPermissions = !isSystemRole && (isNew || canManagePermissions);
  const canSave = isNew || (!isSystemRole && (canUpdate || canManagePermissions));

  const filteredPermissionSections = useMemo(
    () => groupAccessPermissions(permissions, locale, permissionSearch),
    [permissions, locale, permissionSearch],
  );

  const filteredPermissionCount = useMemo(
    () =>
      filteredPermissionSections.reduce(
        (sectionTotal, currentSection) =>
          sectionTotal +
          currentSection.areas.reduce(
            (areaTotal, currentArea) => areaTotal + currentArea.permissions.length,
            0,
          ),
        0,
      ),
    [filteredPermissionSections],
  );

  const selectedVisibleCount = useMemo(
    () => permissions.filter((permission) => selected.includes(permission.key)).length,
    [permissions, selected],
  );

  const togglePermission = (permission: string) => {
    setSelected((values) =>
      values.includes(permission)
        ? values.filter((item) => item !== permission)
        : [...values, permission],
    );
  };

  const save = async () => {
    if (!name.trim() || (isNew && !code.trim()) || isSystemRole) return;

    try {
      if (isNew) {
        await api.createRole({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          permissions: selected,
        });
      } else if (role) {
        let current = role;

        if (canUpdate && name.trim() !== role.name) {
          current = await api.updateRole(role, name.trim());
        }

        if (canManagePermissions) await api.replacePermissions(current, selected);
      }

      onChanged();
      onClose();
      showToast({ variant: 'success', title: copy('Role updated.') });
    } catch (error) {
      if (!isSessionExpiredError(error)) {
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not save role.')).safeMessage,
        });
      }
    }
  };

  return (
    <DDialog
      open={role !== undefined}
      onClose={onClose}
      title={copy(isNew ? 'Create role' : 'Manage role')}
      size="lg"
      footer={
        canSave ? (
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={onClose}>
              {copy('Cancel')}
            </DButton>
            <DButton onClick={() => void save()} disabled={!name.trim() || (isNew && !code.trim())}>
              {copy('Save role')}
            </DButton>
          </div>
        ) : null
      }
    >
      <div className="space-y-6">
        <div className="space-y-3">
          {!isNew && isSystemRole ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--color-text-muted)]">
                {copy('System role')}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {protectedRoleCopy[locale]}
              </p>
            </div>
          ) : null}

          <div className={isNew ? 'grid gap-4 sm:grid-cols-2' : ''}>
            {isNew ? (
              <DInput
                label={copy('Role code')}
                value={code}
                onChange={(value) => setCode(value.toUpperCase())}
                placeholder={copy('For example, MANAGER')}
              />
            ) : null}

            <DInput
              label={copy('Role name')}
              value={name}
              onChange={setName}
              disabled={!canEditName}
              placeholder={copy('For example, Store Manager')}
            />
          </div>
        </div>

        <section className="border-t border-[var(--color-border)] pt-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  {copy('Permissions')}
                </h3>
                <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                  {permissionSearch.trim()
                    ? `${filteredPermissionCount} ${copy('results')}`
                    : `${selectedVisibleCount}/${permissions.length}`}
                </span>
              </div>
            </div>

            <DSearchInput
              value={permissionSearch}
              onChange={setPermissionSearch}
              placeholder={copy('Search permissions...')}
              debounceMs={0}
              expandedWidth="min(280px, calc(100vw - 140px))"
            />
          </div>

          {filteredPermissionSections.length > 0 ? (
            <div className="max-h-[440px] space-y-5 overflow-y-auto pr-1">
              {filteredPermissionSections.map((permissionSection) => {
                const sectionPermissions = permissionSection.areas.flatMap(
                  (permissionArea) => permissionArea.permissions,
                );
                const sectionSelectedCount = sectionPermissions.filter((permission) =>
                  selected.includes(permission.key),
                ).length;

                return (
                  <div key={permissionSection.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 px-1">
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {permissionSection.label}
                      </p>
                      <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                        {sectionSelectedCount}/{sectionPermissions.length}
                      </span>
                    </div>

                    <DAccordion
                      type="multiple"
                      variant="card"
                      value={expandedGroups}
                      onValueChange={setExpandedGroups}
                    >
                      {permissionSection.areas.map((permissionArea) => {
                        const selectedCount = permissionArea.permissions.filter((permission) =>
                          selected.includes(permission.key),
                        ).length;
                        const groupKey = `${permissionSection.key}:${permissionArea.key}`;

                        return (
                          <DAccordionItem
                            key={groupKey}
                            value={groupKey}
                            title={
                              <span className="flex items-center gap-2">
                                <span>{permissionArea.label}</span>
                                <span className="text-xs font-normal tabular-nums text-[var(--color-text-muted)]">
                                  {selectedCount}/{permissionArea.permissions.length}
                                </span>
                              </span>
                            }
                          >
                            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                              {permissionArea.permissions.map((permission) => {
                                const checked = selected.includes(permission.key);
                                return (
                                  <label
                                    key={permission.key}
                                    className={[
                                      'flex min-h-10 items-center gap-3 rounded-md px-2 py-2',
                                      'transition-colors',
                                      canEditPermissions
                                        ? 'cursor-pointer hover:bg-[var(--color-surface-subtle)]'
                                        : 'cursor-default',
                                    ].join(' ')}
                                  >
                                    <DCheckbox
                                      checked={checked}
                                      onChange={() => togglePermission(permission.key)}
                                      disabled={!canEditPermissions}
                                    />
                                    <span
                                      className={[
                                        'min-w-0 flex-1 break-words text-sm leading-5',
                                        checked
                                          ? 'font-medium text-[var(--color-text)]'
                                          : 'text-[var(--color-text-muted)]',
                                      ].join(' ')}
                                    >
                                      {permission.label[locale]}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </DAccordionItem>
                        );
                      })}
                    </DAccordion>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-32 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] px-6 py-8">
              <p className="text-sm text-[var(--color-text-muted)]">
                {copy('No permissions found')}
              </p>
            </div>
          )}
        </section>
      </div>
    </DDialog>
  );
}
