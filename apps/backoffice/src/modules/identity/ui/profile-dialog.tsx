import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { DBadge, DDialog, DInput, useToast } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { isSessionExpiredError, useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import {
  RecordDialogFooter,
  RecordDialogTitle,
  RecordPanel,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import { AccessControlApi, type SelfProfile } from '../access-control-api';
import {
  DISPLAY_NAME_MAX,
  USERNAME_PATTERN,
  identityConflictOf,
  type IdentityConflict,
} from '../model/identity-form';
import { useIdentityConflictCopy } from './identity-conflict-copy';

/**
 * Self-service profile from the account menu: display name and sign-in username are editable, the
 * verified phone and the roles are shown read-only. The Runtime targets the authenticated account
 * only, so this surface can never change roles, status, phone or tenant.
 */
export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const bootstrap = useDeploymentBootstrap();
  const { createApiClient, refreshSessionContext } = useBackofficeAuth();
  const api = useMemo(
    () => new AccessControlApi(createApiClient(bootstrap.apiBaseUrl)),
    [createApiClient, bootstrap.apiBaseUrl],
  );
  const profile = useQuery({
    queryKey: ['auth', 'self'],
    queryFn: () => api.getSelf(),
    enabled: open,
    gcTime: 0,
  });
  if (!open) return null;
  return (
    <ProfileForm
      key={profile.data?.id ?? 'loading'}
      api={api}
      loading={profile.isLoading}
      failed={profile.isError}
      profile={profile.data ?? null}
      onClose={onClose}
      onSaved={async () => {
        await refreshSessionContext();
      }}
    />
  );
}

function ProfileForm({
  api,
  profile,
  loading,
  failed,
  onClose,
  onSaved,
}: {
  api: AccessControlApi;
  profile: SelfProfile | null;
  loading: boolean;
  failed: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<IdentityConflict | null>(null);
  const conflictCopy = useIdentityConflictCopy();

  const nameChanged = Boolean(profile) && displayName.trim() !== profile?.displayName;
  const usernameChanged = Boolean(profile) && username.trim() !== (profile?.username ?? '');
  const nameMissing = !displayName.trim();
  const usernameInvalid =
    usernameChanged && (!username.trim() || !USERNAME_PATTERN.test(username.trim()));
  const dirty = nameChanged || usernameChanged;

  const save = async () => {
    setAttempted(true);
    if (!profile || nameMissing || usernameInvalid || !dirty || saving) return;
    setSaving(true);
    try {
      await api.updateSelf({
        ...(nameChanged ? { displayName: displayName.trim() } : {}),
        ...(usernameChanged ? { username: username.trim() } : {}),
      });
      await onSaved();
      showToast({ variant: 'success', title: copy('Profile updated.') });
      onClose();
    } catch (error) {
      if (isSessionExpiredError(error)) return;
      const failure = normalizeBackofficeApiError(error, copy('Could not update your profile.'));
      const identity = identityConflictOf(failure.code);
      if (identity?.field === 'username') setConflict(identity.code);
      else showToast({ variant: 'danger', title: failure.safeMessage });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open
      onClose={saving ? () => undefined : onClose}
      title={<RecordDialogTitle title={copy('Profile')} />}
      size="md"
      footer={
        <RecordDialogFooter
          onClose={onClose}
          onSave={() => void save()}
          saving={saving}
          disabled={!profile || !dirty}
          saveLabel={copy('Save changes')}
        />
      }
    >
      {failed ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {copy('Could not load your profile.')}
        </p>
      ) : loading || !profile ? (
        <p role="status" className="text-sm text-[var(--color-text-muted)]">
          {copy('Loading...')}
        </p>
      ) : (
        <div className="space-y-4">
          <RecordPanel>
            <RecordSectionLabel>{copy('Account details')}</RecordSectionLabel>
            <div className="mt-4 space-y-4">
              <DInput
                label={copy('Display name')}
                value={displayName}
                maxLength={DISPLAY_NAME_MAX}
                onChange={setDisplayName}
                error={attempted && nameMissing ? copy('Enter a display name.') : undefined}
                disabled={saving}
                autoFocus
              />
              <DInput
                label={copy('Sign-in username')}
                value={username}
                maxLength={64}
                onChange={(value) => {
                  setConflict(null);
                  setUsername(value);
                }}
                autoCapitalize="none"
                autoComplete="off"
                hint={copy(
                  'Not case-sensitive. You stay signed in and use the new name the next time you sign in.',
                )}
                error={
                  attempted && usernameInvalid
                    ? copy('Use 3 to 64 letters, numbers, dot, underscore, or hyphen.')
                    : conflict
                      ? conflictCopy[conflict]
                      : undefined
                }
                disabled={saving}
              />
              <DInput
                label={copy('Verified phone number')}
                value={profile.phoneE164}
                disabled
                onChange={() => undefined}
                hint={copy('Ask an administrator to change the phone number on your account.')}
              />
            </div>
          </RecordPanel>
          <RecordPanel>
            <RecordSectionLabel>{copy('Roles')}</RecordSectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.roles.map((role) => (
                <DBadge key={role.id} variant={role.systemKey === 'OWNER' ? 'info' : 'secondary'}>
                  {role.name}
                </DBadge>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
              {copy('Roles and account status are managed by an administrator.')}
            </p>
          </RecordPanel>
        </div>
      )}
    </DDialog>
  );
}
