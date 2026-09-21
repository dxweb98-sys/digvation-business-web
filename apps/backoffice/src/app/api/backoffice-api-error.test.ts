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
});
