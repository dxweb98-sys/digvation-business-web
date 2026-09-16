import { render, screen } from '@testing-library/react';
import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationLoading } from './authentication-loading';

vi.mock('../app/localization/backoffice-localization', () => ({
  useBackofficeLocalization: () => ({ locale: 'id' }),
}));

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: {
    mode: 'FIXED',
    workspace: 'staging',
  },
  applications: {
    backoffice: true,
    operational: true,
  },
  branding: {
    mode: 'DIGVATION_DEFAULT',
    productName: 'Digvation Business',
    companyName: 'Digvation Indonesia',
  },
  theme: {
    preset: 'DIGVATION_LIGHT',
    radius: 'SOFT',
  },
  defaults: {
    locale: 'id-ID',
    country: 'ID',
  },
} satisfies DeploymentBootstrapConfig;

describe('AuthenticationLoading', () => {
  it('renders from deployment bootstrap before an authenticated runtime projection exists', () => {
    render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <AuthenticationLoading />
      </DeploymentBootstrapProvider>,
    );

    expect(screen.getByText('Menyiapkan Backoffice')).toBeInTheDocument();
    expect(screen.getByText('Digvation Business')).toBeInTheDocument();
  });
});
