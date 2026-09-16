import { useRuntime } from '@digvation/business-runtime';
import {
  DButton,
  DConfirmDialog,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { OperationalAccessApi } from '../operational-access/operational-access-api';
import {
  AccessControlApi,
  type AccessRole,
  type AccessUser,
  type UserInvitation,
} from './access-control-api';
import {
  InvitationDialog,
  InvitationsTable,
} from './access-invitation-management';
import { RoleEditor, RolesTable } from './access-role-management';
import { UserEditor, UsersTable } from './access-user-management';

const keys = {
  roles: ['access-control', 'roles'] as const,
  permissions: ['access-control', 'permissions'] as const,
  users: ['access-control', 'users'] as const,
  invitations: ['access-control', 'invitations'] as const,
};
const pageSize = 50;
type Section = 'roles' | 'users' | 'invitations';

const pageDescription = {
  id: 'Kelola pengguna, peran, undangan, izin, dan akses lokasi.',
  en: 'Manage users, roles, invitations, permissions, and location access.',
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
  const isOwner = Boolean(
    session?.identity.roles.some((role) => role.systemKey === 'OWNER'),
  );
  const canInviteUsers = Boolean(
    session && isOwner && canPerformBackofficeAction(session, 'inviteUsers'),
  );
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
        Undang pengguna
      </DButton>
    ) : null;

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Configuration')}
        title={copy('Access Control')}
        description={pageDescription[locale]}
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
          permissions={permissions.data?.items ?? []}
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
        title="Batalkan undangan?"
        message="Tautan undangan yang masih aktif tidak akan dapat digunakan lagi."
        confirmLabel="Batalkan undangan"
        variant="danger"
      />
    </BackofficePage>
  );
}
