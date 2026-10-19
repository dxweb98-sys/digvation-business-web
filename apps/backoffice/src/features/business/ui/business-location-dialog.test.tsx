import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import type { BusinessSettingsApi, SellingLocation } from '../api/business-settings-api';
import { BusinessLocationDialog } from './business-location-dialog';
import { BusinessLocationsSection } from './business-locations-section';

vi.mock('../../../auth/backoffice-auth-context', () => ({
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

describe('BusinessLocationDialog address editing', () => {
  it('loads the existing address into the field when editing a Location', () => {
    const target = location({ address: 'Jl. Alam Sutera Boulevard No. 10, Tangerang' });
    renderWithProviders(
      <BusinessLocationDialog
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
      <BusinessLocationDialog
        location={null}
        items={[]}
        api={{ createLocation } as unknown as BusinessSettingsApi}
        onClose={vi.fn()}
        onChanged={onChanged}
      />,
    );

    fireEvent.change(screen.getByLabelText('Kode lokasi'), { target: { value: 'BSD' } });
    fireEvent.change(screen.getByLabelText('Nama lokasi'), {
      target: { value: 'Salon BSD' },
    });
    fireEvent.change(screen.getByLabelText(/Alamat lokasi/), {
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
      <BusinessLocationDialog
        location={target}
        items={[target]}
        api={{ updateLocation } as unknown as BusinessSettingsApi}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Alamat lokasi/), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan lokasi' }));

    await vi.waitFor(() => expect(updateLocation).toHaveBeenCalledTimes(1));
    const [, updateInput] = updateLocation.mock.calls[0] as unknown as Parameters<
      BusinessSettingsApi['updateLocation']
    >;
    expect(updateInput).toMatchObject({ address: '' });
  });
});

describe('BusinessLocationsSection address presentation', () => {
  it('shows the configured address for a Location', () => {
    renderWithProviders(
      <BusinessLocationsSection
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
      <BusinessLocationsSection
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

describe('BusinessLocationDialog structure and rules', () => {
  it('keeps identity, address and main branch in one form panel and names the location', () => {
    const target = location();
    renderWithProviders(
      <BusinessLocationDialog
        location={target}
        items={[target]}
        api={{} as BusinessSettingsApi}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    const dialog = within(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog').querySelectorAll('section')).toHaveLength(1);
    expect((dialog.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    expect(dialog.getByText(/Untuk menggantinya, jadikan lokasi lain/)).toBeTruthy();
    expect(dialog.getByText('Kode hanya ditentukan saat membuat lokasi.')).toBeTruthy();
    expect((dialog.getByLabelText('Kode lokasi') as HTMLInputElement).disabled).toBe(true);
    expect(dialog.getAllByText('MAIN').length).toBeGreaterThan(0);
  });

  it('makes the first location the main branch and uppercases its code', async () => {
    const createLocation = vi.fn(async () => location());
    renderWithProviders(
      <BusinessLocationDialog
        location={null}
        items={[]}
        api={{ createLocation } as unknown as BusinessSettingsApi}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Kode lokasi'), { target: { value: 'bsd' } });
    fireEvent.change(screen.getByLabelText('Nama lokasi'), { target: { value: 'Salon BSD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan lokasi' }));

    await vi.waitFor(() =>
      expect(createLocation).toHaveBeenCalledWith({
        code: 'BSD',
        name: 'Salon BSD',
        setAsMain: true,
        address: '',
      }),
    );
  });

  it('promotes another location to main branch only when asked', async () => {
    const branch = location({ id: 'location-2', code: 'BSD', name: 'Salon BSD', isMain: false });
    const updateLocation = vi.fn(async () => branch);
    renderWithProviders(
      <BusinessLocationDialog
        location={branch}
        items={[location(), branch]}
        api={{ updateLocation } as unknown as BusinessSettingsApi}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan lokasi' }));

    await vi.waitFor(() =>
      expect(updateLocation).toHaveBeenCalledWith(branch, {
        name: 'Salon BSD',
        setAsMain: true,
        address: '',
      }),
    );
  });

  it('offers placeholders for name, code and the optional address', () => {
    renderWithProviders(
      <BusinessLocationDialog
        location={null}
        items={[]}
        api={{} as BusinessSettingsApi}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('Nama cabang, mis. Salon BSD')).toBeTruthy();
    expect(screen.getByPlaceholderText('Contoh: BSD')).toBeTruthy();
    expect(screen.getByPlaceholderText('Jalan, kawasan, kota')).toBeTruthy();
    expect(screen.getByLabelText('Alamat lokasi (opsional)')).toBeTruthy();
  });

  it('shows an error next to a cleared name and blocks saving', () => {
    renderWithProviders(
      <BusinessLocationDialog
        location={null}
        items={[]}
        api={{} as BusinessSettingsApi}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByText('Masukkan nama lokasi.')).toBeNull();
    fireEvent.change(screen.getByLabelText('Nama lokasi'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Nama lokasi'), { target: { value: '' } });
    expect(screen.getByText('Masukkan nama lokasi.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Simpan lokasi' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('BusinessLocationsSection deactivation', () => {
  it('deactivates a non-main branch and never offers it for the main branch', async () => {
    const branch = location({ id: 'location-2', code: 'BSD', name: 'Salon BSD', isMain: false });
    const updateLocation = vi.fn(async () => branch);
    renderWithProviders(
      <BusinessLocationsSection
        items={[location(), branch]}
        loading={false}
        canCreate
        canUpdate
        api={{ updateLocation } as unknown as BusinessSettingsApi}
        onChanged={vi.fn()}
      />,
    );

    const rowOf = (text: string) =>
      screen
        .getAllByText(text)
        .map((node) => node.closest('tr'))
        .find((node): node is HTMLTableRowElement => Boolean(node))!;
    fireEvent.click(rowOf('MAIN').querySelector('[data-ds-component="dropdown-trigger"] > *')!);
    expect(screen.queryByText('Nonaktifkan lokasi penjualan')).toBeNull();

    fireEvent.click(rowOf('BSD').querySelector('[data-ds-component="dropdown-trigger"] > *')!);
    fireEvent.click((await screen.findAllByText('Nonaktifkan lokasi penjualan')).at(-1)!);
    fireEvent.click(await screen.findByRole('button', { name: 'Nonaktifkan' }));

    await vi.waitFor(() =>
      expect(updateLocation).toHaveBeenCalledWith(branch, { status: 'INACTIVE' }),
    );
  });
});
