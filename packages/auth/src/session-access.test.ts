import { describe, expect, it } from 'vitest';

import type { AuthSession } from './auth.types';
import {
  hasSessionCapability,
  hasSessionFoundation,
  hasSessionPermission,
  hasSessionProduct,
} from './session-access';

const session = {
  access: {
    products: ['POS'],
    capabilities: ['LOYALTY_POINTS'],
    foundations: ['CATALOG'],
    permissions: ['catalog:read'],
  },
} as Pick<AuthSession, 'access'>;

describe('session access helpers', () => {
  it('reads canonical effective session access without application-specific aliases', () => {
    expect(hasSessionProduct(session, 'POS')).toBe(true);
    expect(hasSessionCapability(session, 'LOYALTY_POINTS')).toBe(true);
    expect(hasSessionFoundation(session, 'CATALOG')).toBe(true);
    expect(hasSessionPermission(session, 'catalog:read')).toBe(true);
  });

  it('is false for missing session or missing grants', () => {
    expect(hasSessionCapability(null, 'LOYALTY_POINTS')).toBe(false);
    expect(hasSessionPermission(session, 'catalog:update')).toBe(false);
  });
});
