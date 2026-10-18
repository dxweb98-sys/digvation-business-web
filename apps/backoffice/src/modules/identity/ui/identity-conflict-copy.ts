import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import type { IdentityConflict } from '../model/identity-form';

/** Localized, field-specific messages for Runtime identity conflicts (invitations and renames). */
export function useIdentityConflictCopy(): Record<IdentityConflict, string> {
  const { copy } = useBackofficeLocalization();
  return {
    USER_PHONE_ALREADY_EXISTS: copy('This phone number already belongs to a user.'),
    INVITATION_PHONE_PENDING: copy(
      'This phone number already has a pending invitation. Resend or revoke it first.',
    ),
    USER_USERNAME_ALREADY_EXISTS: copy('This username already belongs to a user.'),
    INVITATION_USERNAME_PENDING: copy(
      'This username already has a pending invitation. Resend or revoke it first.',
    ),
    USER_EMAIL_ALREADY_EXISTS: copy('This email already belongs to a user.'),
    INVITATION_EMAIL_PENDING: copy(
      'This email already has a pending invitation. Resend or revoke it first.',
    ),
  };
}
