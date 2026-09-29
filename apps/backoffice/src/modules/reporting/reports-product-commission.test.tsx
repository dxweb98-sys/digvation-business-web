import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import type * as runtime from '@digvation/business-runtime';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../app/localization/backoffice-localization-base';
import { isReportAvailable } from './report-availability';
import { ReportsPage } from './reports-page';

const entry = (overrides: Record<string, unknown>) => ({
  id: 'e1',
  entryType: 'EARN',
  saleNumber: 'TRX-20260929-000001',
  occurredAt: '2026-09-29T03:00:00.000Z',
  sellingLocation: 'Cabang utama',
  employeeName: 'Andi',
  productName: 'Shampoo Premium',
  variantName: null,
  quantity: '2.0000',
  commissionPerUnit: '5000.0000',
  commissionAmount: '10000.0000',
  ...overrides,
});

const dataset = {
  type: 'product-commission',
  summary: {
    entryCount: 2,
    earnedAmount: '10000.0000',
    reversedAmount: '-10000.0000',
    netCommission: '0.0000',
    earnedQuantity: '2.0000',
  },
  analytics: {
    trend: [],
    breakdown: [],
    breakdowns: {},
    ranking: [{ label: 'Andi', value: '0.0000' }],
  },
  items: [entry({ id: 'r1', entryType: 'REVERSAL', commissionAmount: '-10000.0000' }), entry({})],
  total: 130,
  page: 1,
  pageSize: 25,
};

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'test' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const requests: string[] = [];
const get = vi.fn(async (url: string) => {
  requests.push(url);
  if (url.includes('/operational-access/context'))
    return {
      organizationWide: true,
      resolution: 'AUTO_RESOLVED',
      selectedLocationId: null,
      locations: [],
    };
  if (url.includes('/reports/product-commission')) return dataset;
  return { items: [] };
});

vi.mock('@digvation/business-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof runtime>()),
  useRuntime: () => ({ apiBaseUrl: '' }),
}));
vi.mock('../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({
    createApiClient: () => ({ get: (url: string) => get(url), post: vi.fn() }),
    getAccessToken: async () => 'token',
    session: {
      identity: { permissions: ['commission:read'] },
      access: {
        permissions: ['commission:read'],
        products: ['POS'],
        capabilities: [],
        foundations: [],
      },
    },
  }),
  isSessionExpiredError: () => false,
}));

afterEach(() => {
  cleanup();
  requests.length = 0;
});

function renderReport() {
  window.history.replaceState(
    null,
    '',
    '/?type=product-commission&dateFrom=2026-09-29&dateTo=2026-09-29',
  );
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <QueryClientProvider client={new QueryClient()}>
          <ReportsPage />
        </QueryClientProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}

describe('Product commission report', () => {
  it('shows earned, reversal and net separately with the sale reference', async () => {
    renderReport();
    expect((await screen.findAllByText('TRX-20260929-000001')).length).toBeGreaterThan(0);
    const rows = screen.getAllByRole('row');
    const reversal = rows.find((row) => row.textContent?.includes('Komisi dibatalkan'))!;
    const earned = rows.find((row) => row.textContent?.includes('Komisi diperoleh'))!;
    expect(reversal.textContent).toMatch(/-\s?Rp\s?10\.000|Rp\s?-10\.000|−\s?Rp\s?10\.000/);
    expect(earned.textContent).toMatch(/Rp\s?10\.000/);
    expect(earned.textContent).toContain('Andi');
    expect(earned.textContent).toContain('Shampoo Premium');
    expect(earned.textContent).toContain('Cabang utama');
    // The net of an earned and fully reversed commission is zero.
    expect(screen.getAllByText(/Rp\s?0/).length).toBeGreaterThan(0);
  });

  it('requests a bounded server-side page for the selected period', async () => {
    renderReport();
    await screen.findAllByText('TRX-20260929-000001');
    const url = requests.find((entryUrl) => entryUrl.includes('/reports/product-commission'))!;
    expect(url).toContain('dateFrom=2026-09-29');
    expect(url).toContain('dateTo=2026-09-29');
    expect(url).toContain('page=1');
    expect(url).toContain('pageSize=25');
  });

  it('offers the entry type filter and a sale, employee or product search', async () => {
    renderReport();
    await screen.findAllByText('TRX-20260929-000001');
    expect(screen.getByLabelText('Cari transaksi, karyawan atau produk')).toBeTruthy();
    expect(screen.getAllByText('Jenis catatan').length).toBeGreaterThan(0);
  });
});

describe('Product commission report availability', () => {
  const session = (permissions: string[], products = ['POS']) =>
    ({ access: { permissions, products } }) as never;

  it('uses its own commission:read permission, not pricing or sales permissions', () => {
    expect(isReportAvailable(session(['commission:read']), 'product-commission')).toBe(true);
    expect(isReportAvailable(session(['sales:read', 'pricing:read']), 'product-commission')).toBe(
      false,
    );
  });

  it('requires the POS product', () => {
    expect(isReportAvailable(session(['commission:read'], []), 'product-commission')).toBe(false);
  });
});
