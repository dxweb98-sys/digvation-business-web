import { describe, expect, it } from 'vitest';

import { MockAuthAdapter } from './mock-auth.adapter';

describe('MockAuthAdapter', () => {
  it('provides development identity without exposing token mechanics', async () => {
    const adapter = new MockAuthAdapter();
    const session = await adapter.me();

    expect(session?.identity.displayName).toBe('Demo Operator');
    expect(session?.access.permissions).toContain('auth:self');
  });
});
