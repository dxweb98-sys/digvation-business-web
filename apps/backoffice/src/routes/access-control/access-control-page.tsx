import {
  DButton,
  DBadge,
  DCheckbox,
  DConfirmDialog,
  DDataTable,
  DDialog,
  DInput,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Pencil, UserCog } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useRuntime } from '@digvation/pos-runtime';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { isSessionExpiredError, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { AccessControlApi, type AccessRole, type AccessUser } from './access-control-api';

const accessControlKeys = {
  roles: ['access-control', 'roles'] as const,
  permissions: ['access-control', 'permissions'] as const,
  users: ['access-control', 'users'] as const,
};
const defaultPageSize = 20;

export function AccessControlPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const api = useMemo(
    () => new AccessControlApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const [section, setSection] = useState<'roles' | 'users'>('roles');
  const [rolesOffset, setRolesOffset] = useState(0);
  const [rolesPageSize, setRolesPageSize] = useState(defaultPageSize);
  const [usersOffset, setUsersOffset] = useState(0);
  const [usersPageSize, setUsersPageSize] = useState(defaultPageSize);
  const [editingRole, setEditingRole] = useState<AccessRole | null | undefined>(undefined);
  const [editingUser, setEditingUser] = useState<AccessUser | null>(null);
  const [deactivatingRole, setDeactivatingRole] = useState<AccessRole | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { copy } = useBackofficeLocalization();
  const rolesQuery = useQuery({
    queryKey: [...accessControlKeys.roles, rolesOffset, rolesPageSize],
    queryFn: () => api.listRoles({ limit: rolesPageSize, offset: rolesOffset }),
  });
  const permissionsQuery = useQuery({
    queryKey: accessControlKeys.permissions,
    queryFn: () => api.listPermissions(),
  });
  const usersQuery = useQuery({
    queryKey: [...accessControlKeys.users, usersOffset, usersPageSize],
    queryFn: () => api.listUsers({ limit: usersPageSize, offset: usersOffset }),
    enabled: Boolean(session && canPerformBackofficeAction(session, 'viewUsers')),
  });

  if (!session) return null;
  const canCreateRole = canPerformBackofficeAction(session, 'createRole');
  const canUpdateRole = canPerformBackofficeAction(session, 'updateRole');
  const canManagePermissions = canPerformBackofficeAction(session, 'manageRolePermissions');
  const canManageUsers = canPerformBackofficeAction(session, 'manageUserRoles');
  const invalidateRoles = () =>
    void queryClient.invalidateQueries({ queryKey: accessControlKeys.roles });
  const invalidateUsers = () =>
    void queryClient.invalidateQueries({ queryKey: accessControlKeys.users });

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Configuration')}
        title={copy('Access Control')}
        description={copy('Manage tenant roles and user role assignments. Permissions are defined by the POS platform.')}
        actions={
          section === 'roles' && canCreateRole ? (
            <DButton onClick={() => setEditingRole(null)}>{copy('Create role')}</DButton>
          ) : null
        }
      />
      <div className="mt-7 flex gap-1 border-b border-[var(--color-border)]">
        <SectionButton active={section === 'roles'} onClick={() => setSection('roles')}>
          {copy('Roles')}
        </SectionButton>
        {canPerformBackofficeAction(session, 'viewUsers') ? (
          <SectionButton active={section === 'users'} onClick={() => setSection('users')}>
            {copy('Users')}
          </SectionButton>
        ) : null}
      </div>
      {section === 'roles' ? (
        <RolesTable
          roles={rolesQuery.data?.items ?? []}
          total={rolesQuery.data?.total ?? 0}
          isLoading={rolesQuery.isLoading}
          offset={rolesOffset}
          pageSize={rolesPageSize}
          onPageChange={(page) => setRolesOffset((page - 1) * rolesPageSize)}
          onPageSizeChange={(pageSize) => { setRolesPageSize(pageSize); setRolesOffset(0); }}
          onEdit={setEditingRole}
          onDeactivate={setDeactivatingRole}
          canEdit={canUpdateRole || canManagePermissions}
          canDeactivate={canUpdateRole}
        />
      ) : (
        <UsersTable
          users={usersQuery.data?.items ?? []}
          total={usersQuery.data?.total ?? 0}
          isLoading={usersQuery.isLoading}
          offset={usersOffset}
          pageSize={usersPageSize}
          onPageChange={(page) => setUsersOffset((page - 1) * usersPageSize)}
          onPageSizeChange={(pageSize) => { setUsersPageSize(pageSize); setUsersOffset(0); }}
          onEdit={setEditingUser}
          canEdit={canManageUsers}
        />
      )}

      <RoleEditor
        key={editingRole?.id ?? (editingRole === null ? 'new' : 'closed')}
        role={editingRole}
        permissions={permissionsQuery.data?.items.map((item) => item.key) ?? []}
        onClose={() => setEditingRole(undefined)}
        onChanged={invalidateRoles}
        api={api}
        canUpdate={canUpdateRole}
        canManagePermissions={canManagePermissions}
      />
      <UserRoleEditor
        key={editingUser?.id ?? 'closed'}
        user={editingUser}
        roles={rolesQuery.data?.items ?? []}
        onClose={() => setEditingUser(null)}
        onChanged={invalidateUsers}
        api={api}
        canManage={canManageUsers}
      />
      <DConfirmDialog
        open={Boolean(deactivatingRole)}
        onClose={() => setDeactivatingRole(null)}
        onConfirm={() => {
          if (deactivatingRole)
            void api
              .deactivateRole(deactivatingRole)
              .then(() => {
                invalidateRoles();
                showToast({ variant: 'success', title: copy('Role deactivated.') });
                setDeactivatingRole(null);
              })
              .catch((error) => {
                if (!isSessionExpiredError(error))
                  showToast({
                    variant: 'danger',
                    title: normalizeBackofficeApiError(error, copy('Could not deactivate role.'))
                      .safeMessage,
                  });
              });
        }}
        title={copy('Deactivate role?')}
        message={copy("Users will no longer receive this role's permissions.")}
        confirmLabel={copy('Deactivate')}
        variant="danger"
      />
    </BackofficePage>
  );
}

function RolesTable({
  roles,
  total,
  isLoading,
  offset,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onDeactivate,
  canEdit,
  canDeactivate,
}: {
  roles: AccessRole[];
  total: number;
  isLoading: boolean;
  offset: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEdit: (role: AccessRole) => void;
  onDeactivate: (role: AccessRole) => void;
  canEdit: boolean;
  canDeactivate: boolean;
}) {
  const { copy } = useBackofficeLocalization();
  const columns: TableColumn<AccessRole>[] = [
    {
      key: 'name',
      label: copy('Role'),
      render: (role) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{role.name}</span>
          {role.systemKey ? <DBadge variant="outline">{copy('System role')}</DBadge> : null}
        </div>
      ),
    },
    { key: 'code', label: copy('Code') },
    {
      key: 'permissions',
      label: copy('Permissions'),
      render: (role) => `${role.permissions.length} permissions`,
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (role) => (
        <DBadge variant={role.status === 'ACTIVE' ? 'outline' : 'secondary'}>
          {role.status === 'ACTIVE' ? 'Active' : 'Inactive'}
        </DBadge>
      ),
    },
  ];

  return (
    <div className="mt-6">
      <DDataTable
        columns={columns}
        data={roles}
        rowKey="id"
        loading={isLoading}
        emptyMessage={copy('No roles are available for this workspace.')}
        pagination={{ page: Math.floor(offset / pageSize) + 1, pageSize, total }}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        actions={[
          {
            label: copy('Manage role'),
            icon: <Pencil className="size-4" />,
            onClick: onEdit,
            show: (role) => !role.systemKey && canEdit,
          },
          {
            label: copy('Deactivate role'),
            icon: <Ban className="size-4" />,
            variant: 'danger',
            onClick: onDeactivate,
            show: (role) => !role.systemKey && canDeactivate && role.status === 'ACTIVE',
          },
        ]}
      />
    </div>
  );
}

function UsersTable({
  users,
  total,
  isLoading,
  offset,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onEdit,
  canEdit,
}: {
  users: AccessUser[];
  total: number;
  isLoading: boolean;
  offset: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEdit: (user: AccessUser) => void;
  canEdit: boolean;
}) {
  const { copy } = useBackofficeLocalization();
  const columns: TableColumn<AccessUser>[] = [
    { key: 'displayName', label: copy('User') },
    { key: 'username', label: copy('Username'), render: (user) => user.username ?? copy('No username') },
    {
      key: 'roles',
      label: copy('Roles'),
      render: (user) => user.roles.map((role) => role.name).join(', ') || copy('No roles assigned'),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (user) => (
        <DBadge variant={user.status === 'ACTIVE' ? 'outline' : 'secondary'}>
          {formatUserStatus(user.status)}
        </DBadge>
      ),
    },
  ];

  return (
    <div className="mt-6">
      <DDataTable
        columns={columns}
        data={users}
        rowKey="id"
        loading={isLoading}
        emptyMessage={copy('No POS users are available for this workspace.')}
        pagination={{ page: Math.floor(offset / pageSize) + 1, pageSize, total }}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        actions={[
          {
            label: copy('Manage roles'),
            icon: <UserCog className="size-4" />,
            onClick: onEdit,
            show: () => canEdit,
          },
        ]}
      />
    </div>
  );
}

function RoleEditor({
  role,
  permissions,
  onClose,
  onChanged,
  api,
  canUpdate,
  canManagePermissions,
}: {
  role: AccessRole | null | undefined;
  permissions: string[];
  onClose: () => void;
  onChanged: () => void;
  api: AccessControlApi;
  canUpdate: boolean;
  canManagePermissions: boolean;
}) {
  const { showToast } = useToast();
  const { copy } = useBackofficeLocalization();
  const [name, setName] = useState(role?.name ?? '');
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const open = role !== undefined;
  const isNew = role === null;
  const current = role ?? undefined;
  const selectedPermissions = selected;
  const save = async () => {
    try {
      if (isNew) await api.createRole({ code, name, permissions: selectedPermissions });
      else if (current) {
        if (canUpdate && name && name !== current.name) await api.updateRole(current, name);
        if (canManagePermissions) await api.replacePermissions(current, selectedPermissions);
      }
      onChanged();
      showToast({
        variant: 'success',
        title: isNew ? copy('Role added.') : copy('Role updated.'),
      });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(
            error,
            copy('Could not save role.'),
          ).safeMessage,
        });
    }
  };
  const toggle = (key: string) =>
    setSelected((value) =>
      value.includes(key) ? value.filter((item) => item !== key) : [...value, key],
    );
  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={isNew ? copy('Create role') : `${copy('Manage role')}: ${current?.name ?? ''}`}
      description={
        current?.systemKey
          ? copy('System roles are protected by the POS authorization policy.')
          : copy('Role permissions are assigned from the platform permission registry.')
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          {!current?.systemKey && (isNew || canUpdate || canManagePermissions) ? (
            <DButton onClick={() => void save()} disabled={!name || (isNew && !code)}>
              {copy('Save role')}
            </DButton>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        {!current?.systemKey ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {isNew ? (
              <DInput label={copy('Role code')} value={code} onChange={setCode} placeholder="MANAGER" />
            ) : null}
            <DInput
              label={copy('Role name')}
              value={name || current?.name || ''}
              onChange={setName}
              placeholder={copy('For example, Store Manager')}
              disabled={!isNew && !canUpdate}
            />
          </div>
        ) : null}
        <div>
          <p className="text-sm font-semibold">{copy('Permissions')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {permissions.map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                <DCheckbox
                  checked={selectedPermissions.includes(key)}
                  onChange={() => toggle(key)}
                  disabled={Boolean(current?.systemKey) || (!canManagePermissions && !isNew)}
                />
                {formatPermission(key)}
              </label>
            ))}
          </div>
        </div>
      </div>
    </DDialog>
  );
}

function UserRoleEditor({
  user,
  roles,
  onClose,
  onChanged,
  api,
  canManage,
}: {
  user: AccessUser | null;
  roles: AccessRole[];
  onClose: () => void;
  onChanged: () => void;
  api: AccessControlApi;
  canManage: boolean;
}) {
  const { showToast } = useToast();
  const { copy } = useBackofficeLocalization();
  const [selected, setSelected] = useState<string[]>(user?.roles.map((role) => role.id) ?? []);
  const current = selected;
  const toggle = (id: string) =>
    setSelected((value) =>
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id],
    );
  return (
    <DDialog
      open={Boolean(user)}
      onClose={onClose}
      title={copy('Manage user roles')}
      description={user?.displayName}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          {canManage ? (
            <DButton
              onClick={() => {
                if (user)
                  void api
                    .replaceUserRoles(user, current)
                    .then(() => {
                      onChanged();
                      showToast({
                        variant: 'success',
                        title: copy('User roles updated.'),
                      });
                      onClose();
                    })
                    .catch((error) => {
                      if (!isSessionExpiredError(error))
                        showToast({
                          variant: 'danger',
                          title: normalizeBackofficeApiError(
                            error,
                            copy('Could not update user roles.'),
                          ).safeMessage,
                        });
                    });
              }}
            >
              {copy('Save assignments')}
            </DButton>
          ) : null}
        </div>
      }
    >
      <div className="space-y-2">
        {roles.map((role) => (
          <label
            key={role.id}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-3 text-sm"
          >
            <DCheckbox
              checked={current.includes(role.id)}
              disabled={!canManage || Boolean(role.systemKey)}
              onChange={() => toggle(role.id)}
            />
            <span>{role.name}</span>
            {role.systemKey ? <DBadge variant="outline">{copy('Protected')}</DBadge> : null}
          </label>
        ))}
      </div>
    </DDialog>
  );
}

function SectionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium ${active ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
    >
      {children}
    </button>
  );
}
function formatPermission(key: string) {
  return key
    .split(':')
    .map((part) => part.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()))
    .join(' · ');
}

function formatUserStatus(status: AccessUser['status']) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
