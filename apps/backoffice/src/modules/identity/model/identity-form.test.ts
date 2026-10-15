import { describe, expect, it } from 'vitest';

import {
  emptyInvitationForm,
  identityConflictOf,
  sanitizePhoneField,
  toCreateInvitationInput,
  validateInvitationForm,
} from './identity-form';

const valid = {
  ...emptyInvitationForm(),
  displayName: 'Siti Rahma',
  phone: '081234567890',
  roleIds: ['3f1c9e0e-6a54-4a52-8d57-0d1a5a0f6a11'],
};

describe('invitation form model', () => {
  it('accepts national, 62 and +62 phone input and sends canonical E.164', () => {
    for (const phone of ['081234567890', '6281234567890', '+6281234567890', '0062 812-3456-7890']) {
      expect(validateInvitationForm({ ...valid, phone }).valid).toBe(true);
      expect(toCreateInvitationInput({ ...valid, phone }).phoneE164).toBe('+6281234567890');
    }
  });

  it('shows the national format while typing', () => {
    expect(sanitizePhoneField('+62 812 3456 7890')).toBe('081234567890');
    expect(sanitizePhoneField('6281234567890')).toBe('081234567890');
    expect(sanitizePhoneField('0812-3456')).toBe('08123456');
  });

  it('reports field-specific issues', () => {
    const result = validateInvitationForm({
      displayName: '  ',
      phone: '12',
      username: 'a b',
      roleIds: [],
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual({
      displayName: 'DISPLAY_NAME_REQUIRED',
      phone: 'PHONE_INVALID',
      username: 'USERNAME_INVALID',
      roles: 'ROLE_REQUIRED',
    });
    expect(validateInvitationForm({ ...valid, phone: '' }).issues.phone).toBe('PHONE_REQUIRED');
  });

  it('treats the username as optional and keeps display name free of uniqueness rules', () => {
    expect(validateInvitationForm({ ...valid, username: '' }).valid).toBe(true);
    expect(toCreateInvitationInput({ ...valid, username: '  Siti.Rahma ' }).username).toBe(
      'Siti.Rahma',
    );
    expect(toCreateInvitationInput(valid)).not.toHaveProperty('username');
  });

  it('maps Runtime identity conflicts to the field the user must change', () => {
    expect(identityConflictOf('USER_PHONE_ALREADY_EXISTS')?.field).toBe('phone');
    expect(identityConflictOf('INVITATION_PHONE_PENDING')?.field).toBe('phone');
    expect(identityConflictOf('USER_USERNAME_ALREADY_EXISTS')?.field).toBe('username');
    expect(identityConflictOf('INVITATION_USERNAME_PENDING')?.field).toBe('username');
    expect(identityConflictOf('SOMETHING_ELSE')).toBeNull();
  });
});
