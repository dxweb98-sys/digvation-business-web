import {
  DBadge,
  DButton,
  DCheckbox,
  DDataTable,
  DDialog,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type { AccessControlApi, AccessRole, AccessUser } from './access-control-api';
import {
  OperationalAccessApi,
  type OperationalLocation,
} from '../operational-access/operational-access-api';

export function UsersTable({
  users,
  loading,
  canEdit,
  onEdit,
}: {
  users: AccessUser[];
  loading: boolean;
  canEdit: boolean;
  onEdit: (user: AccessUser) => void;
}) {
  const { copy } = useBackofficeLocalization();
  const columns: TableColumn<AccessUser>[] = [
    {
      key: 'displayName',
      label: copy('User'),
      render: (user) => (
        <div>
          <p className="font-medium">{user.displayName}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{user.username ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'roles',
      label: copy('Roles'),
      render: (user) => user.roles.map((role) => role.name).join(', ') || '-',
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (user) => (
        <DBadge variant={user.status === 'ACTIVE' ? 'success' : 'secondary'}>
          {copy(user.status === 'ACTIVE' ? 'Active' : 'Inactive')}
        </DBadge>
      ),
    },
  ];
  return (
    <DDataTable
      columns={columns}
      data={users}
      loading={loading}
      rowKey="id"
      emptyMessage={copy('No users have been created yet.')}
      actions={[
        {
          label: copy('Manage roles'),
          icon: <Pencil className="size-4" />,
          onClick: onEdit,
          show: () => canEdit,
        },
      ]}
    />
  );
}

export function UserEditor({
  user,
  roles,
  api,
  operationalAccess,
  canManageRoles,
  canViewLocations,
  canManageLocations,
  onClose,
  onChanged,
}: {
  user: AccessUser | null;
  roles: AccessRole[];
  api: AccessControlApi;
  operationalAccess: OperationalAccessApi;
  canManageRoles: boolean;
  canViewLocations: boolean;
  canManageLocations: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    () => user?.roles.map((role) => role.id) ?? [],
  );
  const [selectedLocations, setSelectedLocations] = useState<string[] | null>(null);

  const locationAccess = useQuery({
    queryKey: ['access-control', 'locations', user?.id],
    queryFn: async () => ({
      available: await operationalAccess.context(),
      assigned: await operationalAccess.listUserLocations(user!.id),
    }),
    enabled: Boolean(user && canViewLocations),
  });

  const assignedLocationIds = locationAccess.data?.assigned.map((item) => item.id) ?? [];
  const effectiveSelectedLocations = selectedLocations ?? assignedLocationIds;

  const save = async () => {
    if (!user) return;
    try {
      if (canManageRoles) await api.replaceUserRoles(user, selectedRoles);
      if (canManageLocations)
        await operationalAccess.replaceUserLocations(user.id, effectiveSelectedLocations);
      onChanged();
      onClose();
      showToast({ variant: 'success', title: copy('User access updated.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update user access.'))
            .safeMessage,
        });
    }
  };

  const locations: OperationalLocation[] = locationAccess.data?.available.locations ?? [];
  const isOwner = Boolean(user?.roles.some((role) => role.systemKey === 'OWNER'));

  return (
    <DDialog
      open={Boolean(user)}
      onClose={onClose}
      title={`${copy('User access')}: ${user?.displayName ?? ''}`}
      size="lg"
      footer={
        !isOwner && (canManageRoles || canManageLocations) ? (
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={onClose}>
              {copy('Cancel')}
            </DButton>
            <DButton onClick={() => void save()}>{copy('Save access')}</DButton>
          </div>
        ) : null
      }
    >
      {isOwner ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {copy('Owner access is protected and cannot be narrowed here.')}
        </p>
      ) : (
        <div className="space-y-6">
          <SelectionList
            title={copy('Roles')}
            items={roles
              .filter((role) => role.status === 'ACTIVE')
              .map((role) => ({ id: role.id, label: role.name }))}
            selected={selectedRoles}
            disabled={!canManageRoles}
            onToggle={(id) =>
              setSelectedRoles((values) =>
                values.includes(id) ? values.filter((item) => item !== id) : [...values, id],
              )
            }
          />
          {canViewLocations ? (
            <SelectionList
              title={copy('Location Access')}
              items={locations.map((location) => ({
                id: location.id,
                label: `${location.code}, ${location.name}`,
              }))}
              selected={effectiveSelectedLocations}
              disabled={!canManageLocations}
              onToggle={(id) =>
                setSelectedLocations((values) => {
                  const current = values ?? assignedLocationIds;
                  return current.includes(id)
                    ? current.filter((item) => item !== id)
                    : [...current, id];
                })
              }
            />
          ) : null}
        </div>
      )}
    </DDialog>
  );
}

function SelectionList({
  title,
  items,
  selected,
  disabled,
  onToggle,
}: {
  title: string;
  items: Array<{ id: string; label: string }>;
  selected: string[];
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <section>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
            <DCheckbox
              checked={selected.includes(item.id)}
              onChange={() => onToggle(item.id)}
              disabled={disabled}
            />
            <span className="min-w-0 break-words">{item.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
