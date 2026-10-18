import { useQuery } from '@tanstack/react-query';
import { DBadge, DButton, DCheckbox, DDialog, DInput, useToast } from '@digvation/ui';
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
  EMAIL_MAX,
  USERNAME_PATTERN,
  emailStatusOf,
  identityConflictOf,
  isEmailAddress,
  type IdentityConflict,
} from '../model/identity-form';
import { EmailStatusBadge } from './email-status-badge';
import { useIdentityConflictCopy } from './identity-conflict-copy';
import { OwnerGrantNotice, selectsOwner } from './owner-grant-notice';
import { SecurityActivityPanel } from './security-activity-panel';
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
  canUpdateIdentity = false,
  canViewLocations,
  canManageLocations,
  canViewSecurityActivity = false,
  currentUserId,
  onClose,
  onChanged,
}: {
  user: AccessUser;
  roles: AccessRole[];
  api: AccessControlApi;
  operationalAccess: OperationalAccessApi;
  canManageRoles: boolean;
  /** Identity attributes are Owner-only; account status remains separately permissioned. */
  canUpdateProfile: boolean;
  canUpdateIdentity?: boolean;
  canViewLocations: boolean;
  canManageLocations: boolean;
  /** users:read and activity:read: shows the password link history. */
  canViewSecurityActivity?: boolean;
  /** The signed-in user, used to preserve protected Owner account boundaries. */
  currentUserId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username ?? '');
  const [phoneE164, setPhoneE164] = useState(user.phoneE164);
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
  const [email, setEmail] = useState(user.email ?? '');
  const [emailConflict, setEmailConflict] = useState<IdentityConflict | null>(null);

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
  const nameMissing = canUpdateIdentity && !displayName.trim();
  const usernameChanged = username.trim() !== (user.username ?? '');
  // An unchanged username is never re-validated; a changed one must follow the Runtime pattern.
  const usernameInvalid =
    canUpdateIdentity && usernameChanged && !USERNAME_PATTERN.test(username.trim());
  const phoneChanged = phoneE164.trim() !== user.phoneE164;
  const phoneInvalid =
    canUpdateIdentity && phoneChanged && !/^\+[1-9]\d{7,14}$/.test(phoneE164.trim());
  const ownerUnconfirmed = canManageRoles && selectsOwner(roles, selectedRoles) && !ownerConfirmed;
  const emailStatus = emailStatusOf(user);
  // Owners are protected: only an Owner manages their own email from here.
  const canEditEmail =
    canUpdateIdentity &&
    user.status !== 'PENDING_ACTIVATION' &&
    (!isOwner || user.id === currentUserId);
  const emailChanged = email.trim() !== (user.email ?? '');
  const emailInvalid =
    canEditEmail && emailChanged && Boolean(email.trim()) && !isEmailAddress(email);
  const editable =
    (!isOwner && (canManageRoles || canManageLocations || canUpdateProfile || canUpdateIdentity)) ||
    (isOwner && canEditEmail);

  const save = async () => {
    setAttempted(true);
    if (
      nameMissing ||
      usernameInvalid ||
      phoneInvalid ||
      emailInvalid ||
      ownerUnconfirmed ||
      saving
    )
      return;
    setSaving(true);
    try {
      // Each write bumps the user's version, so chain the returned record into the next call.
      let current = user;
      if (canUpdateProfile || canUpdateIdentity) {
        const profile: {
          displayName?: string;
          username?: string;
          phoneE164?: string;
          status?: 'ACTIVE' | 'DISABLED';
          email?: string | null;
        } = {};
        if (!isOwner && canUpdateIdentity) {
          if (displayName.trim() !== user.displayName) profile.displayName = displayName.trim();
          if (usernameChanged) profile.username = username.trim();
          if (phoneChanged) profile.phoneE164 = phoneE164.trim();
        }
        if (!isOwner && canUpdateProfile && accountActive !== (user.status !== 'DISABLED'))
          profile.status = accountActive ? 'ACTIVE' : 'DISABLED';
        // A new or changed address is saved unverified by the Runtime; an empty field removes it.
        if (canEditEmail && emailChanged) profile.email = email.trim() || null;
        if (Object.keys(profile).length) current = await api.updateUser(user, profile);
      }
      // An Owner's roles, status and locations are never changed from this dialog.
      if (!isOwner && canManageRoles) await api.replaceUserRoles(current, selectedRoles);
      if (!isOwner && canManageLocations)
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
        else if (identity?.field === 'email') setEmailConflict(identity.code);
        else showToast({ variant: 'danger', title: failure.safeMessage });
      }
    } finally {
      setSaving(false);
    }
  };

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
            <p className="text-sm text-(--color-text-muted)">
              {copy(
                'Owner is a protected role. Its roles and status are not changed here; an Owner edits their own name and username from Profile.',
              )}
            </p>
          </RecordPanel>
        ) : null}

        {canUpdateIdentity && !isOwner ? (
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
              <DInput
                label={copy('Phone number')}
                value={phoneE164}
                onChange={(value) => setPhoneE164(value)}
                inputMode="tel"
                hint={copy('Use international format, for example +628123456789.')}
                error={
                  attempted && phoneInvalid
                    ? copy('Enter a valid phone number in international format.')
                    : undefined
                }
                disabled={saving}
              />
              {canUpdateProfile ? (
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <DCheckbox
                    checked={accountActive}
                    onChange={() => setAccountActive((value) => !value)}
                    disabled={saving}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-(--color-text)">
                      {copy('Account is active')}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-(--color-text-muted)">
                      {copy('Inactive users cannot sign in and their sessions are ended.')}
                    </span>
                  </span>
                </label>
              ) : null}
            </div>
          </RecordPanel>
        ) : null}

        {canEditEmail || (isOwner && Boolean(user.email)) ? (
          <RecordPanel>
            <div className="flex items-center justify-between gap-3">
              <RecordSectionLabel>{copy('Email')}</RecordSectionLabel>
              <EmailStatusBadge status={emailStatus} />
            </div>
            <div className="mt-4 space-y-3">
              {canEditEmail ? (
                <DInput
                  label={copy('Email (optional)')}
                  value={email}
                  maxLength={EMAIL_MAX}
                  onChange={(value) => {
                    setEmailConflict(null);
                    setEmail(value);
                  }}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="off"
                  placeholder={copy('For example, siti@business.com')}
                  hint={copy(
                    'A new or changed address stays unverified until its owner confirms it. Only a verified email receives password links.',
                  )}
                  error={
                    attempted && emailInvalid
                      ? copy('Enter a valid email address, for example name@business.com.')
                      : emailConflict
                        ? conflictCopy[emailConflict]
                        : undefined
                  }
                  disabled={saving}
                />
              ) : (
                <p className="wrap-break-word text-sm text-(--color-text)">{user.email ?? '-'}</p>
              )}
              {emailStatus !== 'VERIFIED' ? (
                <p className="text-xs leading-5 text-(--color-text-muted)">
                  {copy('Verify this email before a password link can be sent.')}
                </p>
              ) : null}
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
            <p className="mt-3 text-xs leading-5 text-(--color-text-muted)">
              {copy('Without an assigned location this user cannot work at any location.')}
            </p>
            <div className="mt-3 divide-y divide-(--color-border) overflow-hidden rounded-(--radius-control) border border-(--color-border)">
              {locations.map((location) => (
                <label
                  key={location.id}
                  className="flex cursor-pointer items-start gap-3 px-3 py-3 text-sm hover:bg-(--color-surface-muted)"
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
                    <span className="block wrap-break-word font-medium text-(--color-text)">
                      {location.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-(--color-text-muted)">
                      {location.code}
                    </span>
                  </span>
                </label>
              ))}
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
    </DDialog>
  );
}
