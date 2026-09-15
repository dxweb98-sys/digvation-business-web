import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DCheckbox,
  DConfirmDialog,
  DDataTable,
  DDialog,
  DInput,
  DSearchInput,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  DAccordion,
  DAccordionItem,
  useToast,
  type TableColumn,
} from '@digvation/ui';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Pencil, Plus, RefreshCw, UserCog, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { groupPermissionKeys, permissionLabel } from '../../app/localization/human-readable-labels';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { isSessionExpiredError, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import {
  AccessControlApi,
  type AccessRole,
  type AccessUser,
  type UserInvitation,
} from './access-control-api';
import {
  OperationalAccessApi,
  type OperationalLocation,
} from '../operational-access/operational-access-api';

const keys = {
  roles: ['access-control', 'roles'] as const,
  permissions: ['access-control', 'permissions'] as const,
  users: ['access-control', 'users'] as const,
  invitations: ['access-control', 'invitations'] as const,
};
const pageSize = 50;
type Section = 'roles' | 'users' | 'invitations';

const accessCopy = {
  pageDescription: {
    id: 'Kelola pengguna, peran, undangan, izin, dan akses lokasi.',
    en: 'Manage users, roles, invitations, permissions, and location access.',
  },
  protectedRole: {
    id: 'Peran sistem tidak dapat diubah.',
    en: 'System roles cannot be changed.',
  },
  invitationDescription: {
    id: 'Pengguna akan mengaktifkan akun melalui undangan yang dikirim.',
    en: 'The user activates the account through the invitation.',
  },
} as const;

export function AccessControlPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const queryClient = useQueryClient();
  const { copy, locale } = useBackofficeLocalization();
  const api = useMemo(
    () => new AccessControlApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const operationalAccess = useMemo(
    () => new OperationalAccessApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );

  const canViewUsers = Boolean(session && canPerformBackofficeAction(session, 'viewUsers'));
  const canInviteUsers = Boolean(session && canPerformBackofficeAction(session, 'inviteUsers'));
  const canCreateRole = Boolean(session && canPerformBackofficeAction(session, 'createRole'));
  const canUpdateRole = Boolean(session && canPerformBackofficeAction(session, 'updateRole'));
  const canManagePermissions = Boolean(
    session && canPerformBackofficeAction(session, 'manageRolePermissions'),
  );
  const canManageUsers = Boolean(session && canPerformBackofficeAction(session, 'manageUserRoles'));
  const canViewLocations = Boolean(
    session && canPerformBackofficeAction(session, 'viewOperationalAccess'),
  );
  const canManageLocations = Boolean(
    session && canPerformBackofficeAction(session, 'manageOperationalAccess'),
  );

  const [section, setSection] = useState<Section>('roles');
  const [editingRole, setEditingRole] = useState<AccessRole | null | undefined>();
  const [deactivatingRole, setDeactivatingRole] = useState<AccessRole | null>(null);
  const [editingUser, setEditingUser] = useState<AccessUser | null>(null);
  const [inviting, setInviting] = useState(false);
  const [revokingInvitation, setRevokingInvitation] = useState<UserInvitation | null>(null);

  const roles = useQuery({
    queryKey: keys.roles,
    queryFn: () => api.listRoles({ limit: pageSize, offset: 0 }),
    enabled: Boolean(session),
  });
  const permissions = useQuery({
    queryKey: keys.permissions,
    queryFn: () => api.listPermissions(),
    enabled: Boolean(session),
  });
  const users = useQuery({
    queryKey: keys.users,
    queryFn: () => api.listUsers({ limit: pageSize, offset: 0 }),
    enabled: canViewUsers,
  });
  const invitations = useQuery({
    queryKey: keys.invitations,
    queryFn: () => api.listInvitations({ limit: pageSize, offset: 0 }),
    enabled: canViewUsers,
  });

  if (!session) return null;

  const invalidate = (key: readonly string[]) =>
    void queryClient.invalidateQueries({ queryKey: key });

  const actions =
    section === 'roles' && canCreateRole ? (
      <DButton leftIcon={<Plus className="size-4" />} onClick={() => setEditingRole(null)}>
        {copy('Create role')}
      </DButton>
    ) : section === 'invitations' && canInviteUsers ? (
      <DButton leftIcon={<UserPlus className="size-4" />} onClick={() => setInviting(true)}>
        {copy('Invite user')}
      </DButton>
    ) : null;

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Configuration')}
        title={copy('Access Control')}
        description={accessCopy.pageDescription[locale]}
        actions={actions}
      />

      <DTabs
        defaultValue="roles"
        value={section}
        onValueChange={(value) => setSection(value as Section)}
        className="mt-6"
      >
        <DTabsList className="max-w-full overflow-x-auto">
          <DTabsTrigger value="roles">{copy('Roles')}</DTabsTrigger>
          {canViewUsers ? <DTabsTrigger value="users">{copy('Users')}</DTabsTrigger> : null}
          {canViewUsers ? (
            <DTabsTrigger value="invitations">{copy('Invitations')}</DTabsTrigger>
          ) : null}
        </DTabsList>

        <DTabsContent value="roles" className="mt-4">
          <RolesTable
            roles={roles.data?.items ?? []}
            loading={roles.isLoading}
            canEdit={canUpdateRole || canManagePermissions}
            canDeactivate={canUpdateRole}
            onEdit={setEditingRole}
            onDeactivate={setDeactivatingRole}
          />
        </DTabsContent>
        {canViewUsers ? (
          <DTabsContent value="users" className="mt-4">
            <UsersTable
              users={users.data?.items ?? []}
              loading={users.isLoading}
              canEdit={canManageUsers || canManageLocations}
              onEdit={setEditingUser}
            />
          </DTabsContent>
        ) : null}
        {canViewUsers ? (
          <DTabsContent value="invitations" className="mt-4">
            <InvitationsTable
              invitations={invitations.data?.items ?? []}
              loading={invitations.isLoading}
              canManage={canInviteUsers}
              api={api}
              onChanged={() => invalidate(keys.invitations)}
              onRevoke={setRevokingInvitation}
            />
          </DTabsContent>
        ) : null}
      </DTabs>

      {editingRole !== undefined ? (
        <RoleEditor
          key={editingRole?.id ?? 'new'}
          role={editingRole}
          permissions={permissions.data?.items.map((item) => item.key) ?? []}
          api={api}
          canUpdate={canUpdateRole}
          canManagePermissions={canManagePermissions}
          onClose={() => setEditingRole(undefined)}
          onChanged={() => invalidate(keys.roles)}
        />
      ) : null}
      {editingUser ? (
        <UserEditor
          key={editingUser.id}
          user={editingUser}
          roles={roles.data?.items ?? []}
          api={api}
          operationalAccess={operationalAccess}
          canManageRoles={canManageUsers}
          canViewLocations={canViewLocations || canManageLocations}
          canManageLocations={canManageLocations}
          onClose={() => setEditingUser(null)}
          onChanged={() => invalidate(keys.users)}
        />
      ) : null}
      {inviting ? (
        <InvitationDialog
          roles={roles.data?.items.filter((role) => role.status === 'ACTIVE') ?? []}
          api={api}
          onClose={() => setInviting(false)}
          onChanged={() => invalidate(keys.invitations)}
        />
      ) : null}

      <DConfirmDialog
        open={Boolean(deactivatingRole)}
        onClose={() => setDeactivatingRole(null)}
        onConfirm={() => {
          if (!deactivatingRole) return;
          void api.deactivateRole(deactivatingRole).then(() => {
            invalidate(keys.roles);
            setDeactivatingRole(null);
          });
        }}
        title={copy('Deactivate role?')}
        message={copy("Users will no longer receive this role's permissions.")}
        confirmLabel={copy('Deactivate')}
        variant="danger"
      />
      <DConfirmDialog
        open={Boolean(revokingInvitation)}
        onClose={() => setRevokingInvitation(null)}
        onConfirm={() => {
          if (!revokingInvitation) return;
          void api.revokeInvitation(revokingInvitation.id).then(() => {
            invalidate(keys.invitations);
            setRevokingInvitation(null);
          });
        }}
        title={copy('Revoke invitation?')}
        message={copy('The pending invitation can no longer be used to activate an account.')}
        confirmLabel={copy('Revoke')}
        variant="danger"
      />
    </BackofficePage>
  );
}

function RolesTable({
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

function UsersTable({
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

function InvitationsTable({
  invitations,
  loading,
  canManage,
  api,
  onChanged,
  onRevoke,
}: {
  invitations: UserInvitation[];
  loading: boolean;
  canManage: boolean;
  api: AccessControlApi;
  onChanged: () => void;
  onRevoke: (invitation: UserInvitation) => void;
}) {
  const { copy, formatDate } = useBackofficeLocalization();
  const { showToast } = useToast();
  const columns: TableColumn<UserInvitation>[] = [
    {
      key: 'displayName',
      label: copy('User'),
      render: (invitation) => (
        <div>
          <p className="font-medium">{invitation.displayName}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{invitation.phoneE164}</p>
        </div>
      ),
    },
    {
      key: 'roles',
      label: copy('Roles'),
      render: (invitation) => invitation.roles.map((role) => role.name).join(', ') || '-',
    },
    {
      key: 'expiresAt',
      label: copy('Expires'),
      render: (invitation) =>
        formatDate(new Date(invitation.expiresAt), {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
    },
    {
      key: 'acceptedAt',
      label: copy('Status'),
      render: (invitation) => (
        <DBadge
          variant={
            invitation.acceptedAt ? 'success' : invitation.revokedAt ? 'secondary' : 'warning'
          }
        >
          {copy(invitation.acceptedAt ? 'Accepted' : invitation.revokedAt ? 'Revoked' : 'Pending')}
        </DBadge>
      ),
    },
  ];

  const resend = async (invitation: UserInvitation) => {
    try {
      await api.resendInvitation(invitation.id);
      onChanged();
      showToast({ variant: 'success', title: copy('Invitation resent.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not resend invitation.'))
            .safeMessage,
        });
    }
  };

  return (
    <DDataTable
      columns={columns}
      data={invitations}
      loading={loading}
      rowKey="id"
      emptyMessage={copy('No invitations have been created yet.')}
      actions={[
        {
          label: copy('Resend invitation'),
          icon: <RefreshCw className="size-4" />,
          onClick: (invitation) => void resend(invitation),
          show: (invitation) =>
            canManage &&
            !invitation.acceptedAt &&
            !invitation.revokedAt &&
            new Date(invitation.resendAvailableAt).getTime() <= Date.now(),
        },
        {
          label: copy('Revoke invitation'),
          icon: <Ban className="size-4" />,
          variant: 'danger',
          onClick: onRevoke,
          show: (invitation) => canManage && !invitation.acceptedAt && !invitation.revokedAt,
        },
      ]}
    />
  );
}

function RoleEditor({
  role,
  permissions,
  api,
  canUpdate,
  canManagePermissions,
  onClose,
  onChanged,
}: {
  role: AccessRole | null | undefined;
  permissions: string[];
  api: AccessControlApi;
  canUpdate: boolean;
  canManagePermissions: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy, locale } = useBackofficeLocalization();
  const { showToast } = useToast();

  const isNew = role === null;

  const [code, setCode] = useState('');
  const [name, setName] = useState(role?.name ?? '');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const canEditName = isNew || canUpdate;
  const canEditPermissions = isNew || canManagePermissions;
  const canSave = isNew || canUpdate || canManagePermissions;

  /**
   * Gunakan canonical permission grouping yang sudah ada
   * di human-readable-labels.
   *
   * Tidak ada parsing label permission manual di sini.
   */
  const permissionGroups = useMemo(
    () => groupPermissionKeys(permissions, locale),
    [permissions, locale],
  );

  /**
   * Search bisa match:
   * - nama group
   * - nama permission
   */
  const filteredPermissionGroups = useMemo(() => {
    const keyword = permissionSearch.trim().toLocaleLowerCase(locale);

    if (!keyword) {
      return permissionGroups.map((group) => ({
        ...group,
        visiblePermissions: group.permissions,
      }));
    }

    return permissionGroups.flatMap((group) => {
      const groupMatches = group.label.toLocaleLowerCase(locale).includes(keyword);

      const visiblePermissions = groupMatches
        ? group.permissions
        : group.permissions.filter((permission) =>
            permissionLabel(permission, locale).toLocaleLowerCase(locale).includes(keyword),
          );

      if (visiblePermissions.length === 0) {
        return [];
      }

      return [
        {
          ...group,
          visiblePermissions,
        },
      ];
    });
  }, [permissionGroups, permissionSearch, locale]);

  const filteredPermissionCount = useMemo(
    () =>
      filteredPermissionGroups.reduce((total, group) => total + group.visiblePermissions.length, 0),
    [filteredPermissionGroups],
  );

  const togglePermission = (permission: string) => {
    setSelected((values) =>
      values.includes(permission)
        ? values.filter((item) => item !== permission)
        : [...values, permission],
    );
  };

  const save = async () => {
    if (!name.trim() || (isNew && !code.trim())) {
      return;
    }

    try {
      if (isNew) {
        await api.createRole({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          permissions: selected,
        });
      } else if (role) {
        let current = role;

        /**
         * System role tidak lagi dikunci oleh frontend.
         *
         * Yang menentukan boleh/tidaknya edit tetap:
         * - canUpdate
         * - canManagePermissions
         *
         * systemKey sendiri tidak pernah diubah.
         */
        if (canUpdate && name.trim() !== role.name) {
          current = await api.updateRole(role, name.trim());
        }

        if (canManagePermissions) {
          await api.replacePermissions(current, selected);
        }
      }

      onChanged();
      onClose();

      showToast({
        variant: 'success',
        title: copy('Role updated.'),
      });
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
        {/* Role information */}
        <div className="space-y-3">
          {!isNew && role?.systemKey ? (
            <p className="text-xs font-medium text-[var(--color-text-muted)]">
              {copy('System role')}
            </p>
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

        {/* Permissions */}
        <section className="border-t border-[var(--color-border)] pt-5">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  {copy('Permissions')}
                </h3>

                <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                  {permissionSearch.trim()
                    ? `${filteredPermissionCount} ${copy('results')}`
                    : `${selected.length}/${permissions.length}`}
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

          {/* Permission groups */}
          {filteredPermissionGroups.length > 0 ? (
            <div className="max-h-[440px] overflow-y-auto pr-1">
              <DAccordion
                type="multiple"
                variant="card"
                value={expandedGroups}
                onValueChange={setExpandedGroups}
              >
                {filteredPermissionGroups.map((group) => {
                  const selectedCount = group.permissions.filter((permission) =>
                    selected.includes(permission),
                  ).length;

                  return (
                    <DAccordionItem
                      key={group.key}
                      value={group.key}
                      title={
                        <span className="flex items-center gap-2">
                          <span>{group.label}</span>

                          <span className="text-xs font-normal tabular-nums text-[var(--color-text-muted)]">
                            {selectedCount}/{group.permissions.length}
                          </span>
                        </span>
                      }
                    >
                      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                        {group.visiblePermissions.map((permission) => {
                          const checked = selected.includes(permission);

                          return (
                            <label
                              key={permission}
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
                                onChange={() => togglePermission(permission)}
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
                                {permissionLabel(permission, locale)}
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

function UserEditor({
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

function InvitationDialog({
  roles,
  api,
  onClose,
  onChanged,
}: {
  roles: AccessRole[];
  api: AccessControlApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy, locale } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const valid = /^\+[1-9]\d{7,14}$/.test(phone.trim()) && Boolean(displayName.trim());
  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await api.createInvitation({
        phoneE164: phone.trim(),
        ...(username.trim() ? { username: username.trim() } : {}),
        displayName: displayName.trim(),
        roleIds,
      });
      onChanged();
      onClose();
      showToast({ variant: 'success', title: copy('Invitation created.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not create invitation.'))
            .safeMessage,
        });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open
      onClose={onClose}
      title={copy('Invite user')}
      description={accessCopy.invitationDescription[locale]}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton onClick={() => void save()} disabled={!valid || saving}>
            {copy('Send invitation')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DInput
          label={copy('Phone (E.164)')}
          value={phone}
          onChange={setPhone}
          placeholder="+628111111111"
        />
        <DInput
          label={copy('Username (optional)')}
          value={username}
          onChange={setUsername}
          placeholder={copy('For example, cashier.main')}
        />
        <DInput
          label={copy('Display name')}
          value={displayName}
          onChange={setDisplayName}
          placeholder={copy('For example, Siti Rahma')}
        />
      </div>
      <section className="mt-5 border-t border-[var(--color-border)] pt-4">
        <p className="text-sm font-semibold">{copy('Roles')}</p>
        <div className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-3 py-2.5 text-sm">
              <DCheckbox
                checked={roleIds.includes(role.id)}
                onChange={() =>
                  setRoleIds((values) =>
                    values.includes(role.id)
                      ? values.filter((item) => item !== role.id)
                      : [...values, role.id],
                  )
                }
              />
              <span className="min-w-0 break-words">{role.name}</span>
            </label>
          ))}
        </div>
      </section>
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
