import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import type {
  BusinessPreferences,
  BusinessProfile,
  BusinessTaxConfiguration,
  NumberingPreference,
  SellingLocation,
} from '../api/business-settings-api';
import { BusinessPage } from './business-page';

const profile: BusinessProfile = {
  name: 'Salon Maju',
  version: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T03:00:00.000Z',
};
const preferences: BusinessPreferences = {
  defaultLocale: 'id-ID',
  timezone: 'Asia/Jakarta',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: 'HH:mm',
  version: 5,
  createdAt: null,
  updatedAt: null,
};
const tax: BusinessTaxConfiguration = {
  enabled: true,
  rate: '0.11',
  version: 2,
  createdAt: null,
  updatedAt: null,
} as BusinessTaxConfiguration;
const numbering: NumberingPreference[] = [
  {
    namespace: 'PRODUCT',
    prefix: 'PRD',
    padding: 6,
    currentSequence: 124,
    version: 1,
    createdAt: null,
    updatedAt: null,
  },
  {
    namespace: 'INVOICE',
    prefix: 'INV',
    padding: 6,
    currentSequence: 9,
    version: 1,
    createdAt: null,
    updatedAt: null,
  },
];
const mainLocation: SellingLocation = {
  id: 'loc-1',
  code: 'PUSAT',
  name: 'Toko Pusat',
  status: 'ACTIVE',
  version: 1,
  isMain: true,
  address: 'Jl. Sudirman No. 1',
};

const api = {
  getConfiguration: vi.fn(),
  listLocations: vi.fn(),
  getNumbering: vi.fn(),
  updateProfile: vi.fn(),
  updatePreferences: vi.fn(),
  updateTax: vi.fn(),
  updateNumbering: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
};

const ALL_PERMISSIONS = [
  'backoffice:access',
  'business-profile:read',
  'business-profile:update',
  'locations:read',
  'locations:create',
  'locations:update',
  'loyalty:read',
  'loyalty:configure',
  'commission:read',
  'commission:configure',
];
let session: unknown;
function makeSession({
  permissions = ALL_PERMISSIONS,
  capabilities = ['TAX_FISCAL', 'LOYALTY_POINTS'],
}: { permissions?: string[]; capabilities?: string[] } = {}) {
  return {
    access: {
      permissions,
      products: ['POS'],
      capabilities,
      foundations: [],
      // Present but without MULTI_BRANCH: this business is limited to one location.
      entitlements: { modules: { ORGANIZATION: {} }, products: { POS: { enabled: true } } },
    },
    effectiveEntitlements: { products: ['POS'], capabilities },
  };
}

vi.mock('../../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({ status: 'authenticated', session, createApiClient: () => ({}) }),
  isSessionExpiredError: () => false,
}));
vi.mock('@digvation/business-runtime', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRuntime: () => ({ apiBaseUrl: '' }),
}));
vi.mock('../api/business-settings-api', () => ({
  BusinessSettingsApi: vi.fn(function BusinessSettingsApi() {
    return api;
  }),
}));
vi.mock('../../../modules/loyalty/loyalty-configuration-section', () => ({
  LoyaltyConfigurationSection: () => <p>Loyalty section</p>,
}));
vi.mock('../../../modules/commission/product-commission-section', () => ({
  ProductCommissionSection: () => <p>Commission section</p>,
}));

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'test' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

function renderPage() {
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <DToastProvider>
            <BusinessPage />
          </DToastProvider>
        </QueryClientProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}

const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent);
const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const panel = (name: string) => within(screen.getByRole('region', { name }));

beforeEach(() => {
  session = makeSession();
  for (const fn of Object.values(api)) fn.mockReset();
  api.getConfiguration.mockResolvedValue({
    profile: { ...profile, configured: true },
    preferences,
    tax,
  });
  api.listLocations.mockResolvedValue({ items: [mainLocation], total: 1, limit: 100, offset: 0 });
  api.getNumbering.mockResolvedValue(numbering);
  api.updateProfile.mockResolvedValue(profile);
  api.updatePreferences.mockResolvedValue(preferences);
  api.updateTax.mockResolvedValue(tax);
  api.updateNumbering.mockResolvedValue(numbering[0]);
});
afterEach(cleanup);

describe('Business configuration tabs', () => {
  it('groups language & time into Profile instead of a separate tab', async () => {
    renderPage();

    expect(tabNames()).toEqual([
      'Profil',
      'Lokasi',
      'Pajak',
      'Penomoran',
      'Loyalty',
      'Komisi produk',
    ]);
    expect(screen.queryByRole('tab', { name: /Bahasa/ })).toBeNull();
    expect(await screen.findByText('Salon Maju')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Informasi bisnis' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Bahasa & waktu' })).toBeTruthy();
  });

  it('hides tabs whose capability or permission is missing and never loads them', async () => {
    session = makeSession({
      capabilities: [],
      permissions: ['backoffice:access', 'business-profile:read', 'locations:read'],
    });
    renderPage();

    expect(tabNames()).toEqual(['Profil', 'Lokasi', 'Penomoran']);
    expect(screen.queryByText('Loyalty section')).toBeNull();
    expect(screen.queryByText('Commission section')).toBeNull();
  });

  it('does not query profile-owned configuration without profile read access', async () => {
    session = makeSession({ permissions: ['backoffice:access', 'locations:read'] });
    renderPage();

    expect(tabNames()).toEqual(['Lokasi']);
    await waitFor(() => expect(api.listLocations).toHaveBeenCalled());
    expect(api.getConfiguration).not.toHaveBeenCalled();
    expect(api.getNumbering).not.toHaveBeenCalled();
  });
});

describe('Profile tab', () => {
  it('shows business information and language & time view-first, in readable form', async () => {
    renderPage();

    const information = panel('Informasi bisnis');
    expect(await information.findByText('Salon Maju')).toBeTruthy();
    const language = panel('Bahasa & waktu');
    expect(language.getByText('Bahasa Indonesia')).toBeTruthy();
    expect(language.getByText('Asia/Jakarta')).toBeTruthy();
    expect(language.getByText('31/10/2026')).toBeTruthy();
    expect(language.getByText('24 jam (14:30)')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves business information through the Business Profile command only', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ubah informasi' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Ubah informasi bisnis')).toBeTruthy();
    fireEvent.change(dialog.getByLabelText('Nama bisnis'), { target: { value: ' Salon Baru ' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Salon Maju', version: 3 }),
        'Salon Baru',
      ),
    );
    expect(api.updatePreferences).not.toHaveBeenCalled();
  });

  it('saves language & time through the Business Preferences command only', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ubah bahasa & waktu' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Zona waktu'), { target: { value: ' Asia/Makassar ' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(api.updatePreferences).toHaveBeenCalledWith(preferences, {
        defaultLocale: 'id-ID',
        timezone: 'Asia/Makassar',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm',
      }),
    );
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('shows values without edit actions to read-only users', async () => {
    session = makeSession({
      permissions: ['backoffice:access', 'business-profile:read', 'locations:read'],
    });
    renderPage();

    expect(await screen.findByText('Salon Maju')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ubah informasi' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ubah bahasa & waktu' })).toBeNull();
  });
});

describe('Locations tab', () => {
  it('keeps a single-location business from adding another branch', async () => {
    renderPage();
    openTab('Lokasi');

    expect((await screen.findAllByText('Toko Pusat')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('PUSAT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cabang utama').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Tambah lokasi' })).toBeNull();
  });
});

describe('Tax tab', () => {
  it('shows the stored rate as a percentage and saves it back as a rate', async () => {
    renderPage();
    openTab('Pajak');

    const section = panel('Pajak bisnis');
    expect(await section.findByText('11%')).toBeTruthy();
    expect(section.getByText('Aktif')).toBeTruthy();

    fireEvent.click(section.getByRole('button', { name: 'Ubah pajak' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Persentase pajak'), { target: { value: '12.5' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(api.updateTax).toHaveBeenCalledWith(tax, { enabled: true, rate: '0.125' }),
    );
  });
});

describe('Numbering tab', () => {
  it('lists namespaces once and edits only prefix and padding', async () => {
    renderPage();
    openTab('Penomoran');

    expect((await screen.findAllByText('PRD')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('124').length).toBeGreaterThan(0);
    // Invoices apply because POS is enabled.
    expect(screen.getAllByText('INV').length).toBeGreaterThan(0);

    const row = screen
      .getAllByText('PRD')
      .map((node) => node.closest('tr'))
      .find((node): node is HTMLTableRowElement => Boolean(node))!;
    fireEvent.click(row.querySelector('[data-ds-component="dropdown-trigger"] > *')!);
    fireEvent.click((await screen.findAllByText('Ubah penomoran')).at(-1)!);

    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Produk')).toBeTruthy();
    expect(dialog.getByText('124')).toBeTruthy();
    expect(dialog.queryByDisplayValue('124')).toBeNull();
    fireEvent.change(dialog.getByLabelText('Awalan'), { target: { value: 'prod' } });
    fireEvent.change(dialog.getByLabelText('Jumlah digit'), { target: { value: '8' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(api.updateNumbering).toHaveBeenCalledWith(numbering[0], {
        prefix: 'PROD',
        padding: 8,
      }),
    );
  });
});

describe('Business dialogs', () => {
  it('loads the stored values into a single form panel', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ubah bahasa & waktu' }));
    const dialog = within(await screen.findByRole('dialog'));

    expect(screen.getByRole('dialog').querySelectorAll('section')).toHaveLength(1);
    expect((dialog.getByLabelText('Zona waktu') as HTMLInputElement).value).toBe('Asia/Jakarta');
    expect(dialog.getByText('31/10/2026 14:30')).toBeTruthy();
  });

  it('keeps the saved values when a dialog is cancelled', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ubah informasi' }));
    let dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Nama bisnis'), { target: { value: 'Draft' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Batal' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(panel('Informasi bisnis').getByText('Salon Maju')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ubah informasi' }));
    dialog = within(await screen.findByRole('dialog'));
    expect((dialog.getByLabelText('Nama bisnis') as HTMLInputElement).value).toBe('Salon Maju');
  });

  it('shows required-field errors next to the field and blocks saving', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ubah informasi' }));
    const profileDialog = within(await screen.findByRole('dialog'));
    fireEvent.change(profileDialog.getByLabelText('Nama bisnis'), { target: { value: '  ' } });
    expect(profileDialog.getByText('Masukkan nama bisnis.')).toBeTruthy();
    expect(
      (profileDialog.getByRole('button', { name: 'Simpan' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(profileDialog.getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Ubah bahasa & waktu' }));
    const languageDialog = within(await screen.findByRole('dialog'));
    fireEvent.change(languageDialog.getByLabelText('Zona waktu'), { target: { value: '' } });
    expect(languageDialog.getByText('Masukkan zona waktu.')).toBeTruthy();
    expect(
      (languageDialog.getByRole('button', { name: 'Simpan' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('sends one save while a request is in flight and locks Cancel', async () => {
    let finish: (value: unknown) => void = () => undefined;
    api.updateProfile.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ubah informasi' }));
    const dialog = within(await screen.findByRole('dialog'));
    const save = dialog.getByRole('button', { name: 'Simpan' });
    fireEvent.click(save);
    fireEvent.click(save);

    await waitFor(() =>
      expect((dialog.getByRole('button', { name: 'Batal' }) as HTMLButtonElement).disabled).toBe(
        true,
      ),
    );
    expect(api.updateProfile).toHaveBeenCalledTimes(1);
    finish(profile);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('turns tax off without changing the stored rate, and rejects rates above 100%', async () => {
    renderPage();
    openTab('Pajak');
    fireEvent.click(await panel('Pajak bisnis').findByRole('button', { name: 'Ubah pajak' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(screen.getByRole('dialog').querySelectorAll('section')).toHaveLength(1);
    expect(dialog.getByText('Pajak transaksi')).toBeTruthy();
    expect(dialog.getByText('Aktif')).toBeTruthy();

    fireEvent.change(dialog.getByLabelText('Persentase pajak'), { target: { value: '150' } });
    expect(dialog.getByText('Persentase pajak harus antara 0 dan 100.')).toBeTruthy();
    expect((dialog.getByRole('button', { name: 'Simpan' }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.change(dialog.getByLabelText('Persentase pajak'), { target: { value: '11' } });
    fireEvent.click(dialog.getByRole('switch', { name: 'Aktifkan pajak' }));
    expect(dialog.getByText('Tidak aktif')).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(api.updateTax).toHaveBeenCalledWith(tax, { enabled: false, rate: '0.11' }),
    );
  });

  it('rejects an invalid numbering prefix and keeps the sequence read-only', async () => {
    renderPage();
    openTab('Penomoran');
    const row = (await screen.findAllByText('PRD'))
      .map((node) => node.closest('tr'))
      .find((node): node is HTMLTableRowElement => Boolean(node))!;
    fireEvent.click(row.querySelector('[data-ds-component="dropdown-trigger"] > *')!);
    fireEvent.click((await screen.findAllByText('Ubah penomoran')).at(-1)!);
    const dialog = within(await screen.findByRole('dialog'));

    const sequence = within(dialog.getByRole('group', { name: 'Nomor saat ini' }));
    expect(sequence.getByText('124')).toBeTruthy();
    expect(sequence.queryByRole('textbox')).toBeNull();
    fireEvent.change(dialog.getByLabelText('Awalan'), { target: { value: '-P' } });
    expect((dialog.getByRole('button', { name: 'Simpan' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(api.updateNumbering).not.toHaveBeenCalled();
  });
});
