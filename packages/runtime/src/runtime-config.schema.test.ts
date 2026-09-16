import { describe, expect, it } from 'vitest';

import { runtimeConfigSchema } from './runtime-config.schema';

function bootstrap(overrides: Record<string, unknown> = {}) {
  return {
    apiBaseUrl: 'http://127.0.0.1:4003',
    deploymentProfile: 'DEDICATED',
    workspaceResolution: { mode: 'FIXED', workspace: 'digvation-demo' },
    applications: { operational: true, backoffice: true },
    branding: {
      mode: 'WHITE_LABEL',
      productName: 'Point of Sale',
      companyName: 'Example Company',
    },
    theme: {
      preset: 'CUSTOM',
      radius: 'ROUNDED',
      colors: { brand: '#123456', accentCoral: '#F3A08B' },
    },
    defaults: { locale: 'id-ID', defaultCountry: 'ID' },
    ...overrides,
  };
}

describe('deployment bootstrap schema', () => {
  it('keeps bootstrap limited to deployment, application, appearance, and pre-auth defaults', () => {
    const parsed = runtimeConfigSchema.parse(bootstrap());

    expect(parsed).toMatchObject({
      deploymentProfile: 'DEDICATED',
      applications: { operational: true, backoffice: true },
      branding: { mode: 'WHITE_LABEL', productName: 'Point of Sale' },
      defaults: { locale: 'id-ID', defaultCountry: 'ID' },
    });
    expect(parsed).not.toHaveProperty('currency');
    expect(parsed).not.toHaveProperty('effectiveEntitlements');
    expect(parsed).not.toHaveProperty('capabilities');
    expect(parsed.branding).not.toHaveProperty('businessName');
  });

  it('supports same-origin API routing with an empty base URL', () => {
    const parsed = runtimeConfigSchema.parse(bootstrap({ apiBaseUrl: '' }));
    expect(parsed.apiBaseUrl).toBe('');
  });

  it('keeps workspace resolution an explicit pre-auth concern', () => {
    const parsed = runtimeConfigSchema.parse(
      bootstrap({
        workspaceResolution: { mode: 'LOGIN', defaultWorkspace: 'shared-demo' },
      }),
    );
    expect(parsed.workspaceResolution).toEqual({
      mode: 'LOGIN',
      defaultWorkspace: 'shared-demo',
    });
  });
});
