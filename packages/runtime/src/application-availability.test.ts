import { describe, expect, it } from 'vitest';

import { assertApplicationEnabled } from './application-availability';
import type { RuntimeConfig } from './runtime-config.types';

function runtimeWithProducts(
  products: RuntimeConfig['effectiveEntitlements']['products'],
): RuntimeConfig {
  return {
    workspace: 'test',
    apiBaseUrl: 'https://example.test',
    locale: 'en-US',
    currency: 'USD',
    defaultCountry: 'US',
    deploymentProfile: 'SHARED',
    applications: {
      backoffice: true,
      cashier: true,
    },
    effectiveEntitlements: {
      products,
      capabilities: [],
    },
    branding: {
      mode: 'DIGVATION_DEFAULT',
      productName: 'Digvation Business',
      companyName: 'Digvation',
    },
    theme: {
      preset: 'DIGVATION_LIGHT',
      radius: 'SOFT',
    },
    capabilities: {
      notifications: true,
      fulfillment: true,
      customers: true,
      loyalty: false,
    },
  };
}

describe('application availability', () => {
  it('keeps static configuration to application bootstrap, not business authorization', () => {
    expect(() => assertApplicationEnabled(runtimeWithProducts([]), 'cashier')).not.toThrow();
    expect(() => assertApplicationEnabled(runtimeWithProducts(['POS']), 'cashier')).not.toThrow();
  });
});
