import { describe, expect, it } from 'vitest';

import type { BusinessProduct, EffectiveEntitlementConfig } from './runtime-config.types';

/**
 * Mirrors the composition pattern used across Backoffice/Operational:
 * `session.access.products.includes(<product>)`. This proves the shared
 * BusinessProduct vocabulary distinguishes POS/WORKSHOP combinations without
 * introducing a second entitlement store or Workshop-specific type.
 */
function hasProduct(config: EffectiveEntitlementConfig, product: BusinessProduct): boolean {
  return config.products.includes(product);
}

function entitlements(products: readonly BusinessProduct[]): EffectiveEntitlementConfig {
  return { products, capabilities: [] };
}

describe('BusinessProduct composition vocabulary', () => {
  it('recognizes no product entitlement', () => {
    const config = entitlements([]);
    expect(hasProduct(config, 'POS')).toBe(false);
    expect(hasProduct(config, 'WORKSHOP')).toBe(false);
  });

  it('recognizes POS-only entitlement without implying WORKSHOP', () => {
    const config = entitlements(['POS']);
    expect(hasProduct(config, 'POS')).toBe(true);
    expect(hasProduct(config, 'WORKSHOP')).toBe(false);
  });

  it('recognizes WORKSHOP-only entitlement without implying POS', () => {
    const config = entitlements(['WORKSHOP']);
    expect(hasProduct(config, 'POS')).toBe(false);
    expect(hasProduct(config, 'WORKSHOP')).toBe(true);
  });

  it('recognizes POS and WORKSHOP coexisting', () => {
    const config = entitlements(['POS', 'WORKSHOP']);
    expect(hasProduct(config, 'POS')).toBe(true);
    expect(hasProduct(config, 'WORKSHOP')).toBe(true);
  });
});
