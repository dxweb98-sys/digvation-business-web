import { DDialog, DInput, useToast } from '@digvation/ui';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import { useFormState } from '../../../shared/forms/use-form-state';
import {
  RecordDialogFooter,
  RecordDialogTitle,
  RecordPanel,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import type { AccessControlApi, AccessRole } from '../access-control-api';
import {
  DISPLAY_NAME_MAX,
  EMAIL_MAX,
  emptyInvitationForm,
  identityConflictOf,
  sanitizePhoneField,
  toCreateInvitationInput,
  validateInvitationForm,
  type IdentityConflict,
  type IdentityConflictField,
} from '../model/identity-form';
import { useIdentityConflictCopy } from './identity-conflict-copy';
import { OwnerGrantNotice, selectsOwner } from './owner-grant-notice';
import { RoleOptionList } from './role-option-list';

const errorClassName = 'mt-1.5 text-xs text-[var(--color-danger)]';

/**
 * Invite a user. Field problems stay next to their field: client rules appear after the first
 * save attempt, and a Runtime identity conflict is shown under the phone or username it concerns
 * and cleared as soon as that field changes.
 */
export function InvitationDialog({
  roles,
  api,
  onClose,
  onChanged,
}: {
  roles: AccessRole[];
  api: Pick<AccessControlApi, 'createInvitation'>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const form = useFormState(emptyInvitationForm);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  const [conflict, setConflict] = useState<{
    code: IdentityConflict;
    field: IdentityConflictField;
  } | null>(null);
  const validation = validateInvitationForm(form.values);
  const issue = attempted ? validation.issues : {};
  const grantsOwner = selectsOwner(roles, form.values.roleIds);
  const ownerUnconfirmed = grantsOwner && !ownerConfirmed;

  const conflictCopy = useIdentityConflictCopy();
  const phoneError =
    issue.phone === 'PHONE_REQUIRED'
      ? copy('Enter a phone number.')
      : issue.phone === 'PHONE_INVALID'
        ? copy('Enter a valid Indonesian phone number, for example 081234567890.')
        : conflict?.field === 'phone'
          ? conflictCopy[conflict.code]
          : undefined;
  const usernameError =
    issue.username === 'USERNAME_INVALID'
      ? copy('Use 3 to 64 letters, numbers, dot, underscore, or hyphen.')
      : conflict?.field === 'username'
        ? conflictCopy[conflict.code]
        : undefined;

  const emailError =
    issue.email === 'EMAIL_REQUIRED'
      ? copy('Enter the email address the invitation is sent to.')
      : issue.email === 'EMAIL_INVALID'
        ? copy('Enter a valid email address, for example name@business.com.')
        : conflict?.field === 'email'
          ? conflictCopy[conflict.code]
          : undefined;

  const save = async () => {
    setAttempted(true);
    if (!validation.valid || ownerUnconfirmed || saving) return;
    setSaving(true);
    try {
      await api.createInvitation(toCreateInvitationInput(form.values));
      onChanged();
      onClose();
      showToast({ variant: 'success', title: copy('Invitation created.') });
    } catch (error) {
      if (isSessionExpiredError(error)) return;
      const failure = normalizeBackofficeApiError(error, copy('Could not create invitation.'));
      const identity = identityConflictOf(failure.code);
      if (identity) setConflict(identity);
      else showToast({ variant: 'danger', title: failure.safeMessage });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open
      onClose={saving ? () => undefined : onClose}
      title={<RecordDialogTitle title={copy('Invite user')} />}
      size="lg"
      footer={
        <RecordDialogFooter
          onClose={onClose}
          onSave={() => void save()}
          saving={saving}
          saveLabel={copy('Send invitation')}
        />
      }
    >
      <div className="space-y-4">
        <RecordPanel>
          <RecordSectionLabel>{copy('Account details')}</RecordSectionLabel>
          <div className="mt-4 space-y-4">
            <DInput
              label={copy('Display name')}
              value={form.values.displayName}
              maxLength={DISPLAY_NAME_MAX}
              onChange={(value) => form.setField('displayName', value)}
              placeholder={copy('For example, Siti Rahma')}
              error={issue.displayName ? copy('Enter a display name.') : undefined}
              disabled={saving}
              autoFocus
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <DInput
                label={copy('Phone number')}
                value={form.values.phone}
                onChange={(value) => {
                  setConflict((current) => (current?.field === 'phone' ? null : current));
                  form.setField('phone', sanitizePhoneField(value));
                }}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="081234567890"
                hint={copy('Kept on the account for sign-in and account identification.')}
                error={phoneError}
                disabled={saving}
              />
              <DInput
                label={copy('Username (optional)')}
                value={form.values.username}
                onChange={(value) => {
                  setConflict((current) => (current?.field === 'username' ? null : current));
                  form.setField('username', value);
                }}
                autoCapitalize="none"
                autoComplete="off"
                placeholder={copy('For example, cashier.main')}
                hint={copy('Optional sign-in name. It is not case-sensitive.')}
                error={usernameError}
                disabled={saving}
              />
            </div>
          </div>
        </RecordPanel>

        <RecordPanel>
          <RecordSectionLabel>{copy('Invitation email')}</RecordSectionLabel>
          <div className="mt-4">
            <DInput
              label={copy('Email')}
              value={form.values.email}
              maxLength={EMAIL_MAX}
              onChange={(value) => {
                setConflict((current) => (current?.field === 'email' ? null : current));
                form.setField('email', value);
              }}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="off"
              placeholder={copy('For example, siti@business.com')}
              hint={copy('The activation link is sent here and the address is verified on activation.')}
              error={emailError}
              disabled={saving}
            />
          </div>
        </RecordPanel>

        <RecordPanel>
          <RecordSectionLabel>{copy('Roles')}</RecordSectionLabel>
          <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
            {copy(
              'A person can hold several roles. They receive everything every selected role allows.',
            )}
          </p>
          <div className="mt-3">
            <RoleOptionList
              roles={roles}
              selected={form.values.roleIds}
              invalid={Boolean(issue.roles)}
              disabled={saving}
              onToggle={(roleId) =>
                form.setField(
                  'roleIds',
                  form.values.roleIds.includes(roleId)
                    ? form.values.roleIds.filter((item) => item !== roleId)
                    : [...form.values.roleIds, roleId],
                )
              }
            />
            {issue.roles ? (
              <p role="alert" className={errorClassName}>
                {copy('Select at least one role.')}
              </p>
            ) : null}
            {grantsOwner ? (
              <OwnerGrantNotice
                confirmed={ownerConfirmed}
                invalid={attempted && ownerUnconfirmed}
                disabled={saving}
                onConfirmedChange={setOwnerConfirmed}
              />
            ) : null}
          </div>
        </RecordPanel>
      </div>
    </DDialog>
  );
}
