import { describe, expect, it } from 'vitest';

import { normalizeBackofficeApiError } from './backoffice-api-error';

describe('Backoffice API error presentation', () => {
  it('presents an application denial without exposing permission identifiers', () => {
    const normalized = normalizeBackofficeApiError({
      status: 403,
      code: 'BACKOFFICE_ACCESS_DENIED',
      message: 'backoffice:access',
    });

    expect(normalized.status).toBe(403);
    expect(normalized.code).toBe('BACKOFFICE_ACCESS_DENIED');
    expect(normalized.safeMessage).toBe('Akun ini tidak memiliki akses ke Backoffice.');
    expect(normalized.safeMessage).not.toContain('backoffice:access');
  });

  it('explains a phone already registered as a member without naming that member', () => {
    const normalized = normalizeBackofficeApiError({
      status: 409,
      code: 'MEMBERSHIP_PHONE_ALREADY_IN_USE',
      message: 'A member already uses this phone number',
    });

    expect(normalized.safeMessage).toBe('Nomor telepon ini sudah terdaftar sebagai member.');
    expect(normalized.safeMessage).not.toContain('aktif');
  });

  it('points a phone already registered as a customer to enrolling that customer', () => {
    const normalized = normalizeBackofficeApiError({
      status: 409,
      code: 'CUSTOMER_PHONE_ALREADY_EXISTS',
      message: 'A customer already uses this phone number',
    });

    expect(normalized.safeMessage).toBe(
      'Nomor telepon ini sudah terdaftar sebagai pelanggan. Tambahkan sebagai member dari pelanggan tersebut.',
    );
  });
});
