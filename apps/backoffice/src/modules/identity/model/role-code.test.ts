import { describe, expect, it } from 'vitest';

import { invitationStatusOf } from './invitation-status';
import { ROLE_CODE_PATTERN, roleCodeFromName } from './role-code';

describe('roleCodeFromName', () => {
  it('derives a stable uppercase code that satisfies the Runtime pattern', () => {
    expect(roleCodeFromName('Kasir Senior')).toBe('KASIR_SENIOR');
    expect(roleCodeFromName('  Manajer Outlet #2 ')).toBe('MANAJER_OUTLET_2');
    expect(roleCodeFromName('Crème brûlée')).toBe('CREME_BRULEE');
    expect(ROLE_CODE_PATTERN.test(roleCodeFromName('Kasir Senior'))).toBe(true);
  });

  it('is empty when the name has no letters or digits', () => {
    expect(roleCodeFromName('— • —')).toBe('');
  });

  it('never exceeds 64 characters', () => {
    expect(roleCodeFromName('a '.repeat(80)).length).toBeLessThanOrEqual(64);
  });
});

describe('invitationStatusOf', () => {
  const now = Date.parse('2026-10-14T00:00:00Z');
  const base = { acceptedAt: null, revokedAt: null, expiresAt: '2026-10-15T00:00:00Z' };
  it('reports pending, expired, accepted and revoked', () => {
    expect(invitationStatusOf(base, now)).toBe('PENDING');
    expect(invitationStatusOf({ ...base, expiresAt: '2026-10-13T00:00:00Z' }, now)).toBe('EXPIRED');
    expect(
      invitationStatusOf(
        { ...base, acceptedAt: '2026-10-13T00:00:00Z', expiresAt: '2026-10-12T00:00:00Z' },
        now,
      ),
    ).toBe('ACCEPTED');
    expect(
      invitationStatusOf(
        { ...base, revokedAt: '2026-10-12T00:00:00Z', expiresAt: '2026-10-12T00:00:00Z' },
        now,
      ),
    ).toBe('REVOKED');
  });
});
