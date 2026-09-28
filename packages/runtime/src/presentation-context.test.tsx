import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PresentationProvider, usePresentationBundle } from './presentation-context';
import type {
  AuthenticatedRuntimeProjection,
  DeploymentBootstrapConfig,
} from './runtime-config.types';
import {
  AuthenticatedRuntimeProjectionProvider,
  DeploymentBootstrapProvider,
} from './runtime-context';

function bootstrap(
  overrides: Partial<DeploymentBootstrapConfig> = {},
): DeploymentBootstrapConfig {
  return {
    apiBaseUrl: '',
    deploymentProfile: 'SHARED',
    workspaceResolution: { mode: 'LOGIN' },
    applications: { operational: true, backoffice: true },
    branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
    theme: { preset: 'DIGVATION_LIGHT', radius: 'COMPACT' },
    defaults: { locale: 'id-ID', country: 'ID' },
    ...overrides,
  };
}

function projection(
  overrides: Partial<AuthenticatedRuntimeProjection> = {},
): AuthenticatedRuntimeProjection {
  return {
    business: { name: 'Acme', currency: 'IDR' },
    access: { products: [], capabilities: [], foundations: [], permissions: [] },
    preferences: { locale: 'id-ID', timezone: 'Asia/Jakarta', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm' },
    contextVersion: '1',
    ...overrides,
  };
}

function Probe() {
  const bundle = usePresentationBundle();
  return <div data-testid="probe" data-bundle={JSON.stringify(bundle)} />;
}

describe('PresentationProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('resolves the DEFAULT bundle and applies it to documentElement when nothing is configured', () => {
    const { getByTestId } = render(
      <DeploymentBootstrapProvider config={bootstrap()}>
        <PresentationProvider>
          <Probe />
        </PresentationProvider>
      </DeploymentBootstrapProvider>,
    );

    expect(JSON.parse(getByTestId('probe').dataset.bundle ?? '{}')).toEqual({
      appearance: 'DEFAULT',
      motion: 'DEFAULT',
      loginLayout: 'DEFAULT',
      shellLayout: 'DEFAULT',
      splash: 'DEFAULT',
    });
    expect(document.documentElement.dataset.presentationPreset).toBe('DEFAULT');
    expect(document.documentElement.dataset.appearance).toBe('DEFAULT');
  });

  it('resolves the deployment bootstrap suggestion pre-auth', () => {
    const { getByTestId } = render(
      <DeploymentBootstrapProvider config={bootstrap({ presentationPreset: 'AEGIS' })}>
        <PresentationProvider>
          <Probe />
        </PresentationProvider>
      </DeploymentBootstrapProvider>,
    );

    expect(JSON.parse(getByTestId('probe').dataset.bundle ?? '{}')).toEqual({
      appearance: 'AEGIS',
      motion: 'ASSERTIVE',
      loginLayout: 'FOCUSED',
      shellLayout: 'FOCUSED',
      splash: 'IMMERSIVE',
    });
  });

  it('resolves identically post-auth, from the same bootstrap value, regardless of the authenticated projection', () => {
    const { getByTestId } = render(
      <DeploymentBootstrapProvider config={bootstrap({ presentationPreset: 'AEGIS' })}>
        <AuthenticatedRuntimeProjectionProvider projection={projection()}>
          <PresentationProvider>
            <Probe />
          </PresentationProvider>
        </AuthenticatedRuntimeProjectionProvider>
      </DeploymentBootstrapProvider>,
    );

    expect(JSON.parse(getByTestId('probe').dataset.bundle ?? '{}').appearance).toBe('AEGIS');
  });

  it('produces no visual change for the common DEFAULT case across the pre-auth to post-auth transition', () => {
    const preAuth = render(
      <DeploymentBootstrapProvider config={bootstrap()}>
        <PresentationProvider>
          <Probe />
        </PresentationProvider>
      </DeploymentBootstrapProvider>,
    );
    const preAuthBundle = preAuth.getByTestId('probe').dataset.bundle;
    preAuth.unmount();

    const postAuth = render(
      <DeploymentBootstrapProvider config={bootstrap()}>
        <AuthenticatedRuntimeProjectionProvider projection={projection()}>
          <PresentationProvider>
            <Probe />
          </PresentationProvider>
        </AuthenticatedRuntimeProjectionProvider>
      </DeploymentBootstrapProvider>,
    );
    const postAuthBundle = postAuth.getByTestId('probe').dataset.bundle;

    expect(postAuthBundle).toBe(preAuthBundle);
  });

  it('never reads presentationPreset off the authenticated projection — there is no such field to override with', () => {
    const withoutPresentationField: AuthenticatedRuntimeProjection = projection();
    expect('presentationPreset' in withoutPresentationField).toBe(false);

    const { getByTestId } = render(
      <DeploymentBootstrapProvider config={bootstrap({ presentationPreset: 'DEFAULT' })}>
        <AuthenticatedRuntimeProjectionProvider projection={withoutPresentationField}>
          <PresentationProvider>
            <Probe />
          </PresentationProvider>
        </AuthenticatedRuntimeProjectionProvider>
      </DeploymentBootstrapProvider>,
    );

    expect(JSON.parse(getByTestId('probe').dataset.bundle ?? '{}').appearance).toBe('DEFAULT');
  });
});
