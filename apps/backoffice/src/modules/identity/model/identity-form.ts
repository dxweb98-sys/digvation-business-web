import { sanitizeNationalMemberPhone, toCanonicalMemberPhone } from '../../membership/member-phone';

/**
 * Identity input rules for invitations. They mirror the Runtime contract so the form can guide
 * the user; the Runtime remains the authority for validation and for uniqueness.
 */
export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;
export const DISPLAY_NAME_MAX = 160;
export const EMAIL_MAX = 254;
/** A practical shape check; the Runtime decides validity and uniqueness. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type InvitationChannel = 'WHATSAPP' | 'EMAIL';

export interface InvitationFormValues {
  displayName: string;
  /** Typed in Indonesian national format (08…); stored and sent as E.164. */
  phone: string;
  username: string;
  /** Where the activation link goes. EMAIL needs an address and verifies it on activation. */
  deliveryChannel: InvitationChannel;
  email: string;
  roleIds: string[];
}

export type InvitationIssue =
  | 'DISPLAY_NAME_REQUIRED'
  | 'PHONE_REQUIRED'
  | 'PHONE_INVALID'
  | 'USERNAME_INVALID'
  | 'EMAIL_REQUIRED'
  | 'EMAIL_INVALID'
  | 'ROLE_REQUIRED';

export type InvitationField = 'displayName' | 'phone' | 'username' | 'email' | 'roles';

export const emptyInvitationForm = (): InvitationFormValues => ({
  displayName: '',
  phone: '',
  username: '',
  deliveryChannel: 'WHATSAPP',
  email: '',
  roleIds: [],
});

/** National digits while typing: 6281… and +6281… become 081…. */
export const sanitizePhoneField = sanitizeNationalMemberPhone;

export function validateInvitationForm(values: InvitationFormValues): {
  valid: boolean;
  issues: Partial<Record<InvitationField, InvitationIssue>>;
} {
  const issues: Partial<Record<InvitationField, InvitationIssue>> = {};
  const name = values.displayName.trim();
  if (!name) issues.displayName = 'DISPLAY_NAME_REQUIRED';
  if (!values.phone.trim()) issues.phone = 'PHONE_REQUIRED';
  else if (!toCanonicalMemberPhone(values.phone)) issues.phone = 'PHONE_INVALID';
  const username = values.username.trim();
  if (username && !USERNAME_PATTERN.test(username)) issues.username = 'USERNAME_INVALID';
  const email = values.email.trim();
  if (values.deliveryChannel === 'EMAIL' && !email) issues.email = 'EMAIL_REQUIRED';
  else if (email && !isEmailAddress(email)) issues.email = 'EMAIL_INVALID';
  if (values.roleIds.length === 0) issues.roles = 'ROLE_REQUIRED';
  return { valid: Object.keys(issues).length === 0, issues };
}

export function toCreateInvitationInput(values: InvitationFormValues) {
  const phoneE164 = toCanonicalMemberPhone(values.phone);
  if (!phoneE164) throw new Error('INVITATION_PHONE_INVALID');
  const username = values.username.trim();
  const email = values.email.trim();
  return {
    phoneE164,
    ...(username ? { username } : {}),
    displayName: values.displayName.trim(),
    roleIds: values.roleIds,
    ...(email ? { email } : {}),
    deliveryChannel: values.deliveryChannel,
  };
}

export function isEmailAddress(value: string): boolean {
  const email = value.trim();
  return email.length <= EMAIL_MAX && EMAIL_PATTERN.test(email);
}

export type EmailStatus = 'MISSING' | 'UNVERIFIED' | 'VERIFIED';

/** Recovery by email needs a verified address; anything else stays on WhatsApp. */
export function emailStatusOf(user: {
  email?: string | null;
  emailVerifiedAt?: string | null;
}): EmailStatus {
  if (!user.email) return 'MISSING';
  return user.emailVerifiedAt ? 'VERIFIED' : 'UNVERIFIED';
}

/** Runtime identity conflicts, mapped to the field the user has to change. */
export type IdentityConflict =
  | 'USER_PHONE_ALREADY_EXISTS'
  | 'USER_USERNAME_ALREADY_EXISTS'
  | 'INVITATION_PHONE_PENDING'
  | 'INVITATION_USERNAME_PENDING'
  | 'USER_EMAIL_ALREADY_EXISTS'
  | 'INVITATION_EMAIL_PENDING';

export type IdentityConflictField = 'phone' | 'username' | 'email';

const CONFLICT_FIELD: Record<IdentityConflict, IdentityConflictField> = {
  USER_PHONE_ALREADY_EXISTS: 'phone',
  USER_USERNAME_ALREADY_EXISTS: 'username',
  INVITATION_PHONE_PENDING: 'phone',
  INVITATION_USERNAME_PENDING: 'username',
  USER_EMAIL_ALREADY_EXISTS: 'email',
  INVITATION_EMAIL_PENDING: 'email',
};

export function identityConflictOf(
  code: string,
): { code: IdentityConflict; field: IdentityConflictField } | null {
  return code in CONFLICT_FIELD
    ? { code: code as IdentityConflict, field: CONFLICT_FIELD[code as IdentityConflict] }
    : null;
}
