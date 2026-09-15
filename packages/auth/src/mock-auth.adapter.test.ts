import { describe, expect, it } from 'vitest';

import { MockAuthAdapter } from './mock-auth.adapter';

describe('MockAuthAdapter', () => {
  it('provides development identity without exposing token mechanics', async () => {
    const adapter = new MockAuthAdapter();
    const session = await adapter.me();

    expect(session?.identity.displayName).toBe('Demo Cashier');
    expect(session?.identity.permissions).toContain('auth:self');
  });
});
