import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DConfirmDialog,
  DDataTable,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  useToast,
  type TableColumn,
} from '@digvation/ui';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, KeyRound, Mail, Pencil, Plus, RefreshCw, UserCog, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { isSessionExpiredError, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import {
  AccessControlApi,
  type AccessRole,
  type AccessUser,
  type UserInvitation,
} from './access-control-api';
import { invitationStatusOf } from './model/invitation-status';
import { InvitationDialog } from './ui/invitation-dialog';
import { RoleEditorDialog } from './ui/role-editor-dialog';
import { UserEditorDialog } from './ui/user-editor-dialog';
import { EmailStatusBadge } from './ui/email-status-badge';
import { emailStatusOf } from './model/identity-form';
import { OperationalAccessApi } from '../operational-access/operational-access-api';

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
} as const;

export function AccessControlPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const queryClient = useQueryClient();
  const { copy, locale } = useBackofficeLocalization();
  const { showToast } = useToast();
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
  const canUpdateUsers = Boolean(session && canPerformBackofficeAction(session, 'updateUsers'));
  const isOwner = Boolean(session?.identity.roles.some((role) => role.systemKey === 'OWNER'));
  const canUpdateUserIdentity = isOwner && canUpdateUsers;
  const canViewSecurityActivity = Boolean(
    session && canPerformBackofficeAction(session, 'viewSecurityActivity'),
  );
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
  const [verifyingUser, setVerifyingUser] = useState<AccessUser | null>(null);
  const [resettingUser, setResettingUser] = useState<AccessUser | null>(null);
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

  const sendEmailVerification = async () => {
    if (!verifyingUser) return;
    try {
      await api.requestUserEmailVerification(verifyingUser);
      setVerifyingUser(null);
      showToast({ variant: 'success', title: copy('Verification link sent.') });
    } catch (error) {
      const failure = normalizeBackofficeApiError(
        error,
        copy('Could not send the verification link.'),
      );
      showToast({ variant: 'danger', title: failure.safeMessage });
    }
  };

  const sendPasswordLink = async () => {
    if (!resettingUser) return;
    try {
      await api.requestUserPasswordLink(resettingUser);
      setResettingUser(null);
      showToast({ variant: 'success', title: copy('Password link sent.') });
    } catch (error) {
      const failure = normalizeBackofficeApiError(error, copy('Could not send the password link.'));
      showToast({ variant: 'danger', title: failure.safeMessage });
    }
  };

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
              canEdit={canManageUsers || canManageLocations || canUpdateUsers}
              canManageSecurity={canUpdateUsers}
              canManageOwnerSecurity={isOwner}
              onEdit={setEditingUser}
              onRequestVerification={setVerifyingUser}
              onRequestPasswordLink={setResettingUser}
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
        <RoleEditorDialog
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
        <UserEditorDialog
          key={editingUser.id}
          user={editingUser}
          roles={roles.data?.items ?? []}
          api={api}
          operationalAccess={operationalAccess}
          canManageRoles={canManageUsers}
          canUpdateProfile={canUpdateUsers}
          canUpdateIdentity={canUpdateUserIdentity}
          canViewLocations={canViewLocations || canManageLocations}
          canManageLocations={canManageLocations}
          canViewSecurityActivity={canViewSecurityActivity}
          currentUserId={session.identity.userId}
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
        open={Boolean(verifyingUser)}
        onClose={() => setVerifyingUser(null)}
        onConfirm={() => void sendEmailVerification()}
        title={copy('Send verification link?')}
        message={copy(
          'A one-time link is sent to this user email. Only the email owner can verify it.',
        )}
        confirmLabel={copy('Send verification link')}
        variant="primary"
      />
      <DConfirmDialog
        open={Boolean(resettingUser)}
        onClose={() => setResettingUser(null)}
        onConfirm={() => void sendPasswordLink()}
        title={copy('Send password link?')}
        message={copy(
          'A one-time link is sent to the verified email of this user. It replaces any link that is still pending.',
        )}
        confirmLabel={copy('Send password link')}
        variant="primary"
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
          {canEdit ? (
            <button
              type="button"
              onClick={() => onEdit(role)}
              className="rounded-sm text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus)/25"
            >
              {role.name}
            </button>
          ) : (
            <p className="font-medium">{role.name}</p>
          )}
          <p className="text-xs text-(--color-text-muted)">{role.code}</p>
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
  canManageSecurity,
  canManageOwnerSecurity,
  onEdit,
  onRequestVerification,
  onRequestPasswordLink,
}: {
  users: AccessUser[];
  loading: boolean;
  canEdit: boolean;
  canManageSecurity: boolean;
  canManageOwnerSecurity: boolean;
  onEdit: (user: AccessUser) => void;
  onRequestVerification: (user: AccessUser) => void;
  onRequestPasswordLink: (user: AccessUser) => void;
}) {
  const { copy } = useBackofficeLocalization();
  const columns: TableColumn<AccessUser>[] = [
    {
      key: 'displayName',
      label: copy('User'),
      render: (user) => (
        <div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => onEdit(user)}
              className="rounded-sm text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus)/25"
            >
              {user.displayName}
            </button>
          ) : (
            <p className="font-medium">{user.displayName}</p>
          )}
          <p className="text-xs text-(--color-text-muted)">{user.username ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'roles',
      label: copy('Roles'),
      render: (user) => user.roles.map((role) => role.name).join(', ') || '-',
    },
    {
      key: 'email',
      label: copy('Email'),
      render: (user) => (
        <div className="min-w-0 space-y-1">
          {user.email ? <p className="wrap-break-word text-sm">{user.email}</p> : null}
          <EmailStatusBadge status={emailStatusOf(user)} />
        </div>
      ),
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
          label: copy('Manage user'),
          icon: <Pencil className="size-4" />,
          onClick: onEdit,
          show: () => canEdit,
        },
        {
          label: copy('Send verification link'),
          icon: <Mail className="size-4" />,
          onClick: onRequestVerification,
          show: (user) =>
            canManageSecurity &&
            (canManageOwnerSecurity || !user.roles.some((role) => role.systemKey === 'OWNER')) &&
            user.status === 'ACTIVE' &&
            Boolean(user.email) &&
            !user.emailVerifiedAt,
        },
        {
          label: copy('Send password link'),
          icon: <KeyRound className="size-4" />,
          onClick: onRequestPasswordLink,
          show: (user) =>
            canManageSecurity &&
            (canManageOwnerSecurity || !user.roles.some((role) => role.systemKey === 'OWNER')) &&
            user.status === 'ACTIVE' &&
            Boolean(user.emailVerifiedAt),
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
          <p className="text-xs text-(--color-text-muted)">{invitation.phoneE164}</p>
          {invitation.email ? (
            <p className="wrap-break-word text-xs text-(--color-text-muted)">{invitation.email}</p>
          ) : null}
          <p className="text-xs text-(--color-text-muted)">{copy('Sent via email')}</p>
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
      label: copy('Date'),
      render: (invitation) => {
        const status = invitationStatusOf(invitation);
        const when =
          status === 'ACCEPTED'
            ? invitation.acceptedAt
            : status === 'REVOKED'
              ? invitation.revokedAt
              : invitation.expiresAt;
        const label =
          status === 'ACCEPTED'
            ? 'Accepted on'
            : status === 'REVOKED'
              ? 'Revoked on'
              : status === 'EXPIRED'
                ? 'Expired on'
                : 'Valid until';
        return (
          <span className="text-sm">
            <span className="text-(--color-text-muted)">{copy(label)} </span>
            {formatDate(new Date(when ?? invitation.expiresAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        );
      },
    },
    {
      key: 'acceptedAt',
      label: copy('Status'),
      render: (invitation) => {
        const status = invitationStatusOf(invitation);
        return (
          <DBadge
            variant={
              status === 'ACCEPTED'
                ? 'success'
                : status === 'REVOKED'
                  ? 'secondary'
                  : status === 'EXPIRED'
                    ? 'danger'
                    : 'warning'
            }
          >
            {copy(
              status === 'ACCEPTED'
                ? 'Accepted'
                : status === 'REVOKED'
                  ? 'Revoked'
                  : status === 'EXPIRED'
                    ? 'Expired'
                    : 'Pending',
            )}
          </DBadge>
        );
      },
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
