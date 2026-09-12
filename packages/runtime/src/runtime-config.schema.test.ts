import { describe, expect, it } from 'vitest';

import { runtimeConfigSchema } from './runtime-config.schema';

describe('runtime config schema', () => {
  it('keeps deployment topology, branding, applications, and entitlements independent', () => {
    const parsed = runtimeConfigSchema.parse({
      apiBaseUrl: 'http://127.0.0.1:4003',
      workspace: 'digvation-demo',
      locale: 'id-ID',
      currency: 'IDR',
      defaultCountry: 'ID',
      deploymentProfile: 'DEDICATED',
      applications: {
        cashier: true,
        backoffice: false,
      },
      effectiveEntitlements: {
        products: ['POS'],
        capabilities: [
          'FINANCE_OPERATIONS',
          'BUSINESS_ANALYTICS',
          'WORKFORCE_ATTENDANCE',
          'MEMBERSHIP',
          'LOYALTY_POINTS',
          'TAX_FISCAL',
        ],
      },
      branding: {
        mode: 'WHITE_LABEL',
        productName: 'Point of Sale',
        companyName: 'Example Company',
        businessName: 'Example Business',
      },
      theme: {
        preset: 'CUSTOM',
        radius: 'ROUNDED',
        colors: {
          brand: '#123456',
          accentCoral: '#F3A08B',
        },
      },
      capabilities: {
        notifications: false,
        fulfillment: false,
        customers: false,
        loyalty: false,
      },
    });

    expect(parsed.deploymentProfile).toBe('DEDICATED');
    expect(parsed.branding.mode).toBe('WHITE_LABEL');
    expect(parsed.applications.backoffice).toBe(false);
    expect(parsed.effectiveEntitlements.products).toEqual(['POS']);
    expect(parsed.effectiveEntitlements.capabilities).toEqual([
      'FINANCE_OPERATIONS',
      'BUSINESS_ANALYTICS',
      'WORKFORCE_ATTENDANCE',
      'MEMBERSHIP',
      'LOYALTY_POINTS',
      'TAX_FISCAL',
    ]);
    expect(parsed.theme.preset).toBe('CUSTOM');
  });

  it('does not infer capabilities from a dedicated deployment profile', () => {
    const parsed = runtimeConfigSchema.parse({
      apiBaseUrl: 'http://127.0.0.1:4003',
      workspace: 'standard-dedicated',
      locale: 'id-ID',
      currency: 'IDR',
      defaultCountry: 'ID',
      deploymentProfile: 'DEDICATED',
      applications: { cashier: true, backoffice: true },
      effectiveEntitlements: { products: ['POS'], capabilities: [] },
      branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation' },
      theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
      capabilities: {
        notifications: false,
        fulfillment: false,
        customers: false,
        loyalty: false,
      },
    });

    expect(parsed.effectiveEntitlements.capabilities).toEqual([]);
  });
});
