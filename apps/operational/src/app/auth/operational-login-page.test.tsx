import type { AuthPort } from '@digvation/business-auth';
import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OperationalLoginPage } from './operational-login-page';

beforeEach(() => {
  // jsdom has no matchMedia; the login page only reads it to decide initial focus.
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const bootstrap: DeploymentBootstrapConfig = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'digvation-demo' },
  applications: { operational: true, backoffice: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
};

function renderLogin(config: DeploymentBootstrapConfig) {
  return render(
    <DeploymentBootstrapProvider config={config}>
      <DToastProvider>
        <OperationalLoginPage authPort={{} as AuthPort} onAuthenticated={vi.fn()} />
      </DToastProvider>
    </DeploymentBootstrapProvider>,
  );
}

describe('OperationalLoginPage application identity', () => {
  it('keeps the legacy Operational name without a declared application identity', () => {
    const { container } = renderLogin(bootstrap);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Masuk ke Operational');
    expect(container.querySelector('.operational-login__app-label')?.textContent).toBe(
      'Operational',
    );
    expect(container.textContent).not.toContain('POS Salon');
  });

  it('names POS Salon on every application label when the deployment declares it', () => {
    const { container } = renderLogin({ ...bootstrap, operationalApplication: 'POS_SALON_APP' });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Masuk ke POS Salon');
    expect(container.querySelector('.operational-login__app-label')?.textContent).toBe('POS Salon');
    expect(container.querySelector('.operational-login__caption p')?.textContent).toBe('POS Salon');
    expect(container.textContent).not.toContain('Operational');
    // Deployment branding stays the product name; the application name never replaces it.
    expect(container.textContent).toContain('Digvation Business');
  });
});
