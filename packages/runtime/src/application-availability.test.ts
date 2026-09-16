import { describe, expect, it } from 'vitest';

import { assertApplicationEnabled } from './application-availability';
import type { DeploymentBootstrapConfig } from './runtime-config.types';

function bootstrap(applications: DeploymentBootstrapConfig['applications']): DeploymentBootstrapConfig {
  return {
    apiBaseUrl: '',
    deploymentProfile: 'SHARED',
    workspaceResolution: { mode: 'FIXED', workspace: 'test' },
    applications,
    branding: {
      mode: 'DIGVATION_DEFAULT',
      productName: 'Digvation Business',
      companyName: 'Digvation',
    },
    theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
    defaults: { locale: 'en-US', defaultCountry: 'US' },
  };
}

describe('application availability', () => {
  it('uses deployment availability only and does not require business entitlements', () => {
    expect(() =>
      assertApplicationEnabled(bootstrap({ operational: true, backoffice: false }), 'operational'),
    ).not.toThrow();
  });

  it('blocks an application that is disabled for the deployment', () => {
    expect(() =>
      assertApplicationEnabled(bootstrap({ operational: false, backoffice: true }), 'operational'),
    ).toThrow(/operational is not enabled/);
  });
});
