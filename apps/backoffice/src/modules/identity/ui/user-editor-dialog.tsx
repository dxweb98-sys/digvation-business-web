import { useQuery } from '@tanstack/react-query';
import {
  DBadge,
  DButton,
  DCheckbox,
  DConfirmDialog,
  DDialog,
  DInput,
  useToast,
} from '@digvation/ui';
import { MessageCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import {
  RecordDialogFooter,
  RecordDialogTitle,
  RecordPanel,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import type {
  OperationalAccessApi,
  OperationalLocation,
} from '../../operational-access/operational-access-api';
import type { AccessControlApi, AccessRole, AccessUser } from '../access-control-api';
import {
  DISPLAY_NAME_MAX,
  USERNAME_PATTERN,
  identityConflictOf,
  type IdentityConflict,
} from '../model/identity-form';
import { useIdentityConflictCopy } from './identity-conflict-copy';
import { OwnerGrantNotice, selectsOwner } from './owner-grant-notice';
import { passwordResetsKey, SecurityActivityPanel } from './security-activity-panel';
import { RoleOptionList } from './role-option-list';

function toggle(values: string[], id: string): string[] {
  return values.includes(id) ? values.filter((item) => item !== id) : [...values, id];
}

/**
 * Manage one user: profile and status, roles, location access, and a password link. Each section
 * is shown according to the caller's permissions; the Runtime enforces them regardless.
 */
export function UserEditorDialog({
  user,
  roles,
  api,
  operationalAccess,
  canManageRoles,
  canUpdateProfile,
  canViewLocations,
  canManageLocations,
  canViewSecurityActivity = false,
  onClose,
  onChanged,
}: {
  user: AccessUser;
  roles: AccessRole[];
  api: AccessControlApi;
  operationalAccess: OperationalAccessApi;
  canManageRoles: boolean;
  canUpdateProfile: boolean;
  canViewLocations: boolean;
  canManageLocations: boolean;
  /** users:read and activity:read: shows the password link history. */
  canViewSecurityActivity?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username ?? '');
  const [usernameConflict, setUsernameConflict] = useState<IdentityConflict | null>(null);
  const conflictCopy = useIdentityConflictCopy();
  const [accountActive, setAccountActive] = useState(user.status !== 'DISABLED');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(() =>
    user.roles.map((role) => role.id),
  );
  const [selectedLocations, setSelectedLocations] = useState<string[] | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingLink, setConfirmingLink] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  const locationAccess = useQuery({
    queryKey: ['access-control', 'locations', user.id],
    queryFn: async () => ({
      available: await operationalAccess.context(),
      assigned: await operationalAccess.listUserLocations(user.id),
    }),
    enabled: canViewLocations,
  });
  const locations: OperationalLocation[] = locationAccess.data?.available.locations ?? [];
  const assignedLocationIds = locationAccess.data?.assigned.map((item) => item.id) ?? [];
  const locationSelection = selectedLocations ?? assignedLocationIds;

  const isOwner = user.roles.some((role) => role.systemKey === 'OWNER');
  const nameMissing = canUpdateProfile && !displayName.trim();
  const usernameChanged = username.trim() !== (user.username ?? '');
  // An unchanged username is never re-validated; a changed one must follow the Runtime pattern.
  const usernameInvalid =
    canUpdateProfile && usernameChanged && !USERNAME_PATTERN.test(username.trim());
  const ownerUnconfirmed = canManageRoles && selectsOwner(roles, selectedRoles) && !ownerConfirmed;
  const editable = !isOwner && (canManageRoles || canManageLocations || canUpdateProfile);

  const save = async () => {
    setAttempted(true);
    if (nameMissing || usernameInvalid || ownerUnconfirmed || saving) return;
    setSaving(true);
    try {
      // Each write bumps the user's version, so chain the returned record into the next call.
      let current = user;
      if (canUpdateProfile) {
        const profile: { displayName?: string; username?: string; status?: 'ACTIVE' | 'DISABLED' } =
          {};
        if (displayName.trim() !== user.displayName) profile.displayName = displayName.trim();
        if (usernameChanged) profile.username = username.trim();
        if (accountActive !== (user.status !== 'DISABLED'))
          profile.status = accountActive ? 'ACTIVE' : 'DISABLED';
        if (
          profile.displayName !== undefined ||
          profile.username !== undefined ||
          profile.status !== undefined
        )
          current = await api.updateUser(user, profile);
      }
      if (canManageRoles) await api.replaceUserRoles(current, selectedRoles);
      if (canManageLocations)
        await operationalAccess.replaceUserLocations(user.id, locationSelection);
      onChanged();
      onClose();
      showToast({ variant: 'success', title: copy('User access updated.') });
    } catch (error) {
      if (!isSessionExpiredError(error)) {
        const failure = normalizeBackofficeApiError(error, copy('Could not update user access.'));
        const identity = identityConflictOf(failure.code);
        // A taken username is shown under its field; the profile write is a single request, so
        // nothing else was saved yet and the user can correct it and save again.
        if (identity?.field === 'username') setUsernameConflict(identity.code);
        else showToast({ variant: 'danger', title: failure.safeMessage });
      }
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordLink = async () => {
    setSendingLink(true);
    try {
      await api.requestUserPasswordLink(user);
      setConfirmingLink(false);
      void queryClient.invalidateQueries({ queryKey: passwordResetsKey(user.id) });
      showToast({ variant: 'success', title: copy('Password link sent.') });
    } catch (error) {
      if (isSessionExpiredError(error)) return;
      const failure = normalizeBackofficeApiError(error, copy('Could not send the password link.'));
      setConfirmingLink(false);
      showToast({
        variant: 'danger',
        title:
          failure.code === 'PASSWORD_RESET_COOLDOWN'
            ? copy('A link was sent a moment ago. Try again shortly.')
            : failure.code === 'USER_NOT_ACTIVE'
              ? copy('This account is inactive, so a password link cannot be sent.')
              : failure.safeMessage,
      });
    } finally {
      setSendingLink(false);
    }
  };

  const canSendLink = canUpdateProfile && user.status === 'ACTIVE';

  return (
    <DDialog
      open
      onClose={saving ? () => undefined : onClose}
      title={
        <RecordDialogTitle title={copy('Manage user')}>
          {user.username ? <DBadge variant="info">{user.username}</DBadge> : null}
          <DBadge variant={user.status === 'ACTIVE' ? 'success' : 'secondary'}>
            {copy(user.status === 'ACTIVE' ? 'Active' : 'Inactive')}
          </DBadge>
        </RecordDialogTitle>
      }
      size="lg"
      footer={
        editable ? (
          <RecordDialogFooter
            onClose={onClose}
            onSave={() => void save()}
            saving={saving}
            saveLabel={copy('Save changes')}
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
        {isOwner ? (
          <RecordPanel>
            <p className="text-sm text-[var(--color-text-muted)]">
              {copy(
                'Owner is a protected role. Its roles and status are not changed here; an Owner edits their own name and username from Profile.',
              )}
            </p>
          </RecordPanel>
        ) : null}

        {canUpdateProfile && !isOwner ? (
          <RecordPanel>
            <RecordSectionLabel>{copy('Profile')}</RecordSectionLabel>
            <div className="mt-4 space-y-4">
              <DInput
                label={copy('Display name')}
                value={displayName}
                maxLength={DISPLAY_NAME_MAX}
                onChange={(value) => setDisplayName(value)}
                error={attempted && nameMissing ? copy('Enter a display name.') : undefined}
                disabled={saving}
              />
              <DInput
                label={copy('Sign-in username')}
                value={username}
                maxLength={64}
                onChange={(value) => {
                  setUsernameConflict(null);
                  setUsername(value);
                }}
                autoCapitalize="none"
                autoComplete="off"
                hint={copy(
                  'Not case-sensitive. The user keeps their current sessions and uses the new name at the next sign-in.',
                )}
                error={
                  attempted && usernameInvalid
                    ? copy('Use 3 to 64 letters, numbers, dot, underscore, or hyphen.')
                    : usernameConflict
                      ? conflictCopy[usernameConflict]
                      : undefined
                }
                disabled={saving}
              />
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <DCheckbox
                  checked={accountActive}
                  onChange={() => setAccountActive((value) => !value)}
                  disabled={saving}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-[var(--color-text)]">
                    {copy('Account is active')}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
                    {copy('Inactive users cannot sign in and their sessions are ended.')}
                  </span>
                </span>
              </label>
            </div>
          </RecordPanel>
        ) : null}

        {!isOwner ? (
          <RecordPanel>
            <RecordSectionLabel>{copy('Roles')}</RecordSectionLabel>
            <div className="mt-4">
              <RoleOptionList
                roles={roles.filter((role) => role.status === 'ACTIVE')}
                selected={selectedRoles}
                disabled={!canManageRoles || saving}
                onToggle={(id) => setSelectedRoles((values) => toggle(values, id))}
              />
              {canManageRoles && selectsOwner(roles, selectedRoles) ? (
                <OwnerGrantNotice
                  confirmed={ownerConfirmed}
                  invalid={attempted && !ownerConfirmed}
                  disabled={saving}
                  onConfirmedChange={setOwnerConfirmed}
                />
              ) : null}
            </div>
          </RecordPanel>
        ) : null}

        {canViewLocations && !isOwner ? (
          <RecordPanel>
            <RecordSectionLabel>{copy('Location Access')}</RecordSectionLabel>
            <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
              {copy('Without an assigned location this user cannot work at any location.')}
            </p>
            <div className="mt-3 divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)]">
              {locations.map((location) => (
                <label
                  key={location.id}
                  className="flex cursor-pointer items-start gap-3 px-3 py-3 text-sm hover:bg-[var(--color-surface-muted)]"
                >
                  <DCheckbox
                    checked={locationSelection.includes(location.id)}
                    onChange={() =>
                      setSelectedLocations((values) =>
                        toggle(values ?? assignedLocationIds, location.id),
                      )
                    }
                    disabled={!canManageLocations || saving}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium text-[var(--color-text)]">
                      {location.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                      {location.code}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </RecordPanel>
        ) : null}

        {canSendLink ? (
          <RecordPanel>
            <RecordSectionLabel>{copy('Security')}</RecordSectionLabel>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 text-xs leading-5 text-[var(--color-text-muted)] sm:flex-1">
                {copy(
                  'Send a one-time link so this user can set a new password. You never see or set the password.',
                )}
              </p>
              <DButton
                size="sm"
                variant="outline"
                className="self-start sm:self-auto"
                leftIcon={<MessageCircle className="size-4" aria-hidden="true" />}
                onClick={() => setConfirmingLink(true)}
                disabled={saving}
              >
                {copy('Send password link')}
              </DButton>
            </div>
          </RecordPanel>
        ) : null}

        {canViewSecurityActivity ? (
          <SecurityActivityPanel
            userId={user.id}
            api={api}
            canCancel={canUpdateProfile && !isOwner}
          />
        ) : null}
      </div>

      <DConfirmDialog
        open={confirmingLink}
        onClose={() => setConfirmingLink(false)}
        onConfirm={() => void sendPasswordLink()}
        loading={sendingLink}
        title={copy('Send password link?')}
        message={copy(
          'A one-time link is sent via WhatsApp to the number registered for this user. It replaces any link that is still pending. Their current password and sessions stay valid until they use the link.',
        )}
        confirmLabel={copy('Send password link')}
        variant="primary"
      />
    </DDialog>
  );
}
