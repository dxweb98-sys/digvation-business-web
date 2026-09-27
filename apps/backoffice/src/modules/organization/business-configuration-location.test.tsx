import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../app/localization/backoffice-localization-base';
import type { BusinessSettingsApi, SellingLocation } from './business-settings-api';
import { LocationDialog, LocationsSection } from './business-configuration-page';

vi.mock('../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({ status: 'authenticated', session: null }),
  isSessionExpiredError: () => false,
}));

afterEach(cleanup);

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'test' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

function location(overrides: Partial<SellingLocation> = {}): SellingLocation {
  return {
    id: 'location-1',
    code: 'MAIN',
    name: 'Salon Alam Sutera',
    status: 'ACTIVE',
    version: 1,
    isMain: true,
    address: null,
    ...overrides,
  };
}

function renderWithProviders(children: React.ReactNode) {
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <DToastProvider>{children}</DToastProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}

describe('LocationDialog address editing', () => {
  it('loads the existing address into the field when editing a Location', () => {
    const target = location({ address: 'Jl. Alam Sutera Boulevard No. 10, Tangerang' });
    renderWithProviders(
      <LocationDialog
        location={target}
        items={[target]}
        api={{} as BusinessSettingsApi}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Jl. Alam Sutera Boulevard No. 10, Tangerang')).toBeTruthy();
  });

  it('saves a trimmed address when creating a new Location', async () => {
    const createLocation = vi.fn(async () => location());
    const onChanged = vi.fn();
    renderWithProviders(
      <LocationDialog
        location={null}
        items={[]}
        api={{ createLocation } as unknown as BusinessSettingsApi}
        onClose={vi.fn()}
        onChanged={onChanged}
      />,
    );

    fireEvent.change(screen.getByLabelText('Kode lokasi'), { target: { value: 'BSD' } });
    fireEvent.change(screen.getByLabelText('Selling location'), {
      target: { value: 'Salon BSD' },
    });
    fireEvent.change(screen.getByLabelText('Alamat'), {
      target: { value: '  Jl. BSD Raya No. 5  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan lokasi' }));

    await vi.waitFor(() => expect(createLocation).toHaveBeenCalledTimes(1));
    const [createInput] = createLocation.mock.calls[0] as unknown as Parameters<
      BusinessSettingsApi['createLocation']
    >;
    expect(createInput).toMatchObject({
      code: 'BSD',
      name: 'Salon BSD',
      address: 'Jl. BSD Raya No. 5',
    });
  });

  it('sends an explicit empty address so the Runtime contract clears it', async () => {
    const target = location({ address: 'Old address' });
    const updateLocation = vi.fn(async () => target);
    renderWithProviders(
      <LocationDialog
        location={target}
        items={[target]}
        api={{ updateLocation } as unknown as BusinessSettingsApi}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Alamat'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan lokasi' }));

    await vi.waitFor(() => expect(updateLocation).toHaveBeenCalledTimes(1));
    const [, updateInput] = updateLocation.mock.calls[0] as unknown as Parameters<
      BusinessSettingsApi['updateLocation']
    >;
    expect(updateInput).toMatchObject({ address: '' });
  });
});

describe('LocationsSection address presentation', () => {
  it('shows the configured address for a Location', () => {
    renderWithProviders(
      <LocationsSection
        items={[location({ address: 'Jl. Sudirman No. 1' })]}
        loading={false}
        canCreate
        canUpdate
        api={{} as BusinessSettingsApi}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Jl. Sudirman No. 1').length).toBeGreaterThan(0);
  });

  it('shows a not-set placeholder when no address is configured, never a fake address', () => {
    renderWithProviders(
      <LocationsSection
        items={[location({ address: null })]}
        loading={false}
        canCreate
        canUpdate
        api={{} as BusinessSettingsApi}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Belum diatur').length).toBeGreaterThan(0);
  });
});
