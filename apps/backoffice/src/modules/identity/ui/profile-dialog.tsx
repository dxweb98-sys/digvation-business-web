import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { DAvatar, DBadge, DButton, DDialog, DInput, useToast } from '@digvation/ui';
import { AtSign, Mail, Pencil, Phone, UserRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';

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
  isEmailAddress,
  USERNAME_PATTERN,
  identityConflictOf,
  type IdentityConflict,
} from '../model/identity-form';
import { useIdentityConflictCopy } from './identity-conflict-copy';

/** The overview is display-only; the existing self-service endpoint owns every edit. */
export function ProfileDialog({ open, onClose, onRequestPasswordLink = () => undefined }: { open: boolean; onClose: () => void; onRequestPasswordLink?: () => void }) {
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
    <ProfileContent
      key={profile.data?.id ?? 'loading'}
      api={api}
      loading={profile.isLoading}
      failed={profile.isError}
      profile={profile.data ?? null}
      canEdit={Boolean(profile.data?.roles.some((role) => role.systemKey === 'OWNER'))}
      onClose={onClose}
      onRequestPasswordLink={onRequestPasswordLink}
      onSaved={async () => {
        await refreshSessionContext();
      }}
    />
  );
}

function ProfileContent({
  api,
  profile,
  canEdit,
  loading,
  failed,
  onClose,
  onSaved,
  onRequestPasswordLink,
}: {
  api: AccessControlApi;
  profile: SelfProfile | null;
  canEdit: boolean;
  loading: boolean;
  failed: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onRequestPasswordLink: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [conflict, setConflict] = useState<IdentityConflict | null>(null);
  const conflictCopy = useIdentityConflictCopy();

  const nameChanged = Boolean(profile) && displayName.trim() !== profile?.displayName;
  const usernameChanged = Boolean(profile) && username.trim() !== (profile?.username ?? '');
  const emailChanged = Boolean(profile) && email.trim() !== (profile?.email ?? '');
  const nameMissing = !displayName.trim();
  const usernameInvalid =
    usernameChanged && (!username.trim() || !USERNAME_PATTERN.test(username.trim()));
  const emailInvalid = emailChanged && Boolean(email.trim()) && !isEmailAddress(email);
  const dirty = nameChanged || usernameChanged;

  const requestVerification = async () => {
    if (sendingVerification) return;
    setSendingVerification(true);
    try {
      await api.requestOwnEmailVerification();
      showToast({ variant: 'success', title: copy('Verification link sent.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({ variant: 'danger', title: copy('Could not send the verification link.') });
    } finally {
      setSendingVerification(false);
    }
  };

  const save = async () => {
    setAttempted(true);
    if (!profile || nameMissing || usernameInvalid || emailInvalid || !(dirty || emailChanged) || saving)
      return;
    setSaving(true);
    try {
      await api.updateSelf({
        ...(nameChanged ? { displayName: displayName.trim() } : {}),
        ...(usernameChanged ? { username: username.trim() } : {}),
        ...(emailChanged ? { email: email.trim() || null } : {}),
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
      title={<RecordDialogTitle title={copy(editing ? 'Edit profile' : 'Profile')} />}
      size="md"
      footer={
        editing ? (
          <RecordDialogFooter
            onClose={() => setEditing(false)}
            onSave={() => void save()}
            saving={saving}
            disabled={!profile || !(dirty || emailChanged) || emailInvalid}
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
      {failed ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {copy('Could not load your profile.')}
        </p>
      ) : loading || !profile ? (
        <p role="status" className="text-sm text-[var(--color-text-muted)]">
          {copy('Loading...')}
        </p>
      ) : editing ? (
        <ProfileEditor
          profile={profile}
          displayName={displayName}
          email={email}
          username={username}
          attempted={attempted}
          nameMissing={nameMissing}
          emailInvalid={emailInvalid}
          usernameInvalid={usernameInvalid}
          conflict={conflict}
          conflictCopy={conflictCopy}
          saving={saving}
          sendingVerification={sendingVerification}
          onDisplayNameChange={setDisplayName}
          onEmailChange={setEmail}
          onUsernameChange={(value) => {
            setConflict(null);
            setUsername(value);
          }}
          onRequestVerification={() => void requestVerification()}
        />
      ) : (
        <ProfileOverview
          profile={profile}
          canEdit={canEdit}
          sendingVerification={sendingVerification}
          onEdit={() => setEditing(true)}
          onRequestVerification={() => void requestVerification()}
          onRequestPasswordLink={onRequestPasswordLink}
        />
      )}
    </DDialog>
  );
}

function ProfileOverview({
  profile,
  canEdit,
  sendingVerification,
  onEdit,
  onRequestVerification,
  onRequestPasswordLink,
}: {
  profile: SelfProfile;
  canEdit: boolean;
  sendingVerification: boolean;
  onEdit: () => void;
  onRequestVerification: () => void;
  onRequestPasswordLink: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const emailVerified = Boolean(profile.email && profile.emailVerifiedAt);

  return (
    <div className="space-y-4">
      <section className="border-b border-[var(--color-border)] pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <DAvatar
              alt=""
              name={profile.displayName}
              fallback={<UserRound className="size-5" aria-hidden="true" />}
              size="lg"
              className="shrink-0 bg-[var(--color-surface-muted)] text-sm font-bold text-[var(--color-brand)]"
            />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-[var(--color-text)]">
                {profile.displayName}
              </h2>
              <p className="mt-0.5 truncate text-sm text-[var(--color-text-muted)]">
                {profile.username ? `@${profile.username}` : copy('Account')}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.roles.map((role) => (
                  <DBadge key={role.id} variant={role.systemKey === 'OWNER' ? 'info' : 'secondary'}>
                    {role.name}
                  </DBadge>
                ))}
              </div>
            </div>
          </div>
          {canEdit ? (
            <DButton size="sm" variant="secondary" leftIcon={<Pencil className="size-3.5" />} onClick={onEdit}>
              {copy('Edit profile')}
            </DButton>
          ) : null}
        </div>
      </section>

      <section>
        <RecordSectionLabel>{copy('Account details')}</RecordSectionLabel>
        <dl className="mt-3 divide-y divide-[var(--color-border)] rounded-[var(--radius-control)] border border-[var(--color-border)]">
          <ProfileDetail label={copy('Display name')} value={profile.displayName} icon={<UserRound className="size-3.5" aria-hidden="true" />} />
          <ProfileDetail label={copy('Sign-in username')} value={profile.username ? `@${profile.username}` : copy('Not set')} icon={<AtSign className="size-3.5" aria-hidden="true" />} />
          <ProfileDetail label={copy('Phone number')} value={formatPhoneNumber(profile.phoneE164)} icon={<Phone className="size-3.5" aria-hidden="true" />} />
        </dl>
      </section>

      <section className="border-t border-[var(--color-border)] pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <Mail className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <RecordSectionLabel>{copy('Email')}</RecordSectionLabel>
              <p className="mt-1 break-all text-sm font-semibold text-[var(--color-text)]">
                {profile.email ?? copy('Email not set')}
              </p>
            </div>
          </div>
          <DBadge variant={emailVerified ? 'success' : 'secondary'}>
            {copy(emailVerified ? 'Verified' : 'Not verified')}
          </DBadge>
        </div>
        <div className="mt-3">
              <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                {profile.email
                  ? emailVerified
                    ? copy('This email is verified.')
                    : copy('Verify this email before it can receive account-security links.')
                  : copy('Ask an administrator to add or update your email.')}
              </p>
              {profile.email && !emailVerified ? (
                <DButton
                  className="mt-3"
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={sendingVerification}
                  onClick={onRequestVerification}
                >
                  {copy('Send verification link')}
                </DButton>
              ) : null}
        </div>
      </section>
      <section className="border-t border-[var(--color-border)] pt-5">
        <RecordSectionLabel>{copy('Account security')}</RecordSectionLabel>
        <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
          {emailVerified ? copy('A password-change link will be sent to your verified email.') : copy('Verify your email before requesting a password-change link.')}
        </p>
        <DButton className="mt-3" size="sm" variant="secondary" disabled={!emailVerified} onClick={onRequestPasswordLink}>
          {copy('Send password change link')}
        </DButton>
      </section>
    </div>
  );
}

function formatPhoneNumber(phoneE164: string | null): string {
  if (!phoneE164) return '—';
  return phoneE164.startsWith('+62') ? `0${phoneE164.slice(3)}` : phoneE164;
}

function ProfileDetail({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 px-3 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
        <span className="text-[var(--color-brand)]">{icon}</span>
        {label}
      </dt>
      <dd className="break-words text-right text-sm font-semibold text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

function ProfileEditor({
  profile,
  displayName,
  email,
  username,
  attempted,
  nameMissing,
  emailInvalid,
  usernameInvalid,
  conflict,
  conflictCopy,
  saving,
  sendingVerification,
  onDisplayNameChange,
  onEmailChange,
  onUsernameChange,
  onRequestVerification,
}: {
  profile: SelfProfile;
  displayName: string;
  email: string;
  username: string;
  attempted: boolean;
  nameMissing: boolean;
  emailInvalid: boolean;
  usernameInvalid: boolean;
  conflict: IdentityConflict | null;
  conflictCopy: Record<IdentityConflict, string>;
  saving: boolean;
  sendingVerification: boolean;
  onDisplayNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onRequestVerification: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const canVerifyEmail = Boolean(profile.email) && !profile.emailVerifiedAt && email === profile.email;

  return (
    <div className="space-y-4">
      <RecordPanel>
        <RecordSectionLabel>{copy('Account details')}</RecordSectionLabel>
        <div className="mt-4 space-y-4">
          <DInput
            label={copy('Display name')}
            value={displayName}
            maxLength={DISPLAY_NAME_MAX}
            onChange={onDisplayNameChange}
            error={attempted && nameMissing ? copy('Enter a display name.') : undefined}
            disabled={saving}
            autoFocus
          />
          <DInput
            label={copy('Email')}
            value={email}
            type="email"
            inputMode="email"
            autoComplete="email"
            onChange={onEmailChange}
            error={attempted && emailInvalid ? copy('Enter a valid email address.') : undefined}
            hint={
              profile.emailVerifiedAt
                ? copy('Verified. Password links are sent to this address.')
                : copy('Unverified. Confirm the ownership link before password links can be sent.')
            }
            disabled={saving}
          />
          {canVerifyEmail ? (
            <DButton
              type="button"
              size="sm"
              variant="secondary"
              disabled={saving}
              loading={sendingVerification}
              onClick={onRequestVerification}
            >
              {copy('Send verification link')}
            </DButton>
          ) : null}
          <DInput
            label={copy('Sign-in username')}
            value={username}
            maxLength={64}
            onChange={onUsernameChange}
            autoCapitalize="none"
            autoComplete="off"
            hint={copy('Not case-sensitive. You stay signed in and use the new name the next time you sign in.')}
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
  );
}
