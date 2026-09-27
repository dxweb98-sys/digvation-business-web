import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import type * as runtime from '@digvation/business-runtime';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../app/localization/backoffice-localization-base';
import { ReportsPage } from './reports-page';

const longName = 'Red Coloring Brand Professional Permanent Intense Copper Blend';

const dataset = {
  type: 'component-usage',
  period: { dateFrom: '2026-09-01', dateTo: '2026-09-30', sellingLocationId: null },
  summary: {
    transactionCount: 3,
    componentCount: 2,
    usageCount: 4,
    fixedUsageCount: 2,
    selectedUsageCount: 2,
  },
  analytics: {
    trend: [{ label: '2026-09-20', value: '2', count: 1 }],
    breakdown: [
      {
        label: longName,
        value: '46.0000',
        count: 12,
        fixedQuantity: '12.0000',
        selectedQuantity: '34.0000',
        services: [
          { label: 'Hair Color', quantity: '39.0000' },
          { label: 'Highlight', quantity: '7.0000' },
        ],
      },
    ],
    breakdowns: {
      primary: [],
      source: [
        { label: 'FIXED_BOM', value: '2', count: 2 },
        { label: 'SALE_SELECTED', value: '2', count: 2 },
      ],
    },
    ranking: [{ label: longName, value: '46.0000' }],
  },
  items: [
    {
      saleNumber: 'TRX-20260920-000001',
      occurredAt: '2026-09-20T03:00:00.000Z',
      sellingLocation: 'Cabang utama',
      parentItemCode: 'HC',
      parentItemName: 'Hair Color',
      parentVariantName: 'Red',
      componentCode: 'DEV',
      componentName: 'Developer 20 vol',
      componentVariantName: null,
      componentSource: 'FIXED_BOM',
      fixedBomSource: 'SERVICE_VARIANT_OVERRIDE',
      quantityPerUnit: '1.0000',
      parentQuantity: '2.0000',
      usedQuantity: '2.0000',
      sellingUnitAmount: null,
      billedAmount: null,
    },
    {
      saleNumber: 'TRX-20260921-000002',
      occurredAt: '2026-09-21T03:00:00.000Z',
      sellingLocation: 'Cabang utama',
      parentItemCode: 'HL',
      parentItemName: 'Highlight',
      parentVariantName: null,
      componentCode: 'RED',
      componentName: 'Red Coloring Brand',
      componentVariantName: 'Intense',
      componentSource: 'SALE_SELECTED',
      fixedBomSource: null,
      quantityPerUnit: '3.0000',
      parentQuantity: '1.0000',
      usedQuantity: '3.0000',
      sellingUnitAmount: '10000.0000',
      billedAmount: '30000.0000',
    },
  ],
  total: 2,
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
function fakeGet(empty: boolean) {
  return vi.fn(async (url: string) => {
    requests.push(url);
    if (url.includes('/operational-access/context'))
      return {
        organizationWide: true,
        resolution: 'AUTO_RESOLVED',
        selectedLocationId: null,
        locations: [],
      };
    if (url.includes('/reports/component-usage'))
      return empty
        ? {
            ...dataset,
            summary: { ...dataset.summary, usageCount: 0 },
            analytics: { trend: [], breakdown: [], breakdowns: {}, ranking: [] },
            items: [],
            total: 0,
          }
        : dataset;
    return { items: [] };
  });
}

let get = fakeGet(false);
vi.mock('@digvation/business-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof runtime>()),
  useRuntime: () => ({ apiBaseUrl: '' }),
}));
vi.mock('../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({
    createApiClient: () => ({ get: (url: string) => get(url), post: vi.fn() }),
    getAccessToken: async () => 'token',
    session: {
      identity: { permissions: ['sales:read'] },
      access: {
        permissions: ['sales:read'],
        products: ['POS'],
        capabilities: [],
        foundations: [],
      },
    },
  }),
  isSessionExpiredError: () => false,
}));

function renderReport() {
  window.history.replaceState(
    null,
    '',
    '/?type=component-usage&dateFrom=2026-09-01&dateTo=2026-09-30',
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

afterEach(() => {
  cleanup();
  requests.length = 0;
});

describe('Component usage report page', () => {
  it('renders usage by component with the fixed/selected split and detailed rows with source and provenance', async () => {
    get = fakeGet(false);
    renderReport();

    const summary = await screen.findByRole('region', { name: 'Pemakaian per komponen' });
    // 46 = 12 fixed + 34 selected; Hair Color 39 and Highlight 7.
    expect(within(summary).getAllByText('46').length).toBeGreaterThan(0);
    expect(within(summary).getAllByText('12').length).toBeGreaterThan(0);
    expect(within(summary).getAllByText('34').length).toBeGreaterThan(0);
    expect(within(summary).getAllByText(/Hair Color 39 · Highlight 7/).length).toBeGreaterThan(0);
    expect(within(summary).getAllByText(longName).length).toBeGreaterThan(0);

    expect((await screen.findAllByText('TRX-20260920-000001')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tetap / terkonfigurasi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dipilih saat transaksi').length).toBeGreaterThan(0);
    // A Service Variant recipe is shown beside the fixed source, not instead of it.
    expect(screen.getAllByText(/Tetap \/ terkonfigurasi · Varian jasa/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Developer 20 vol').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Intense').length).toBeGreaterThan(0);
  });

  it('shows billed prices for selected additions only, never a price or a fake zero for fixed BOM', async () => {
    get = fakeGet(false);
    renderReport();
    await screen.findAllByText('TRX-20260920-000001');
    const rows = screen.getAllByRole('row');
    const fixedRow = rows.find((row) => row.textContent?.includes('TRX-20260920-000001'))!;
    const selectedRow = rows.find((row) => row.textContent?.includes('TRX-20260921-000002'))!;
    expect(fixedRow.textContent).not.toMatch(/Rp\s?\d/);
    expect(fixedRow.textContent).toContain('—');
    expect(selectedRow.textContent).toMatch(/Rp\s?10\.000/);
    expect(selectedRow.textContent).toMatch(/Rp\s?30\.000/);
  });

  it('uses the standard report query and offers the source filter', async () => {
    get = fakeGet(false);
    renderReport();
    await screen.findAllByText('TRX-20260920-000001');
    const call = requests.find((url) => url.includes('/api/v1/reports/component-usage?'));
    expect(call).toContain('dateFrom=2026-09-01');
    expect(screen.getAllByText('Sumber pemakaian').length).toBeGreaterThan(0);
  });

  it('shows the empty state without the usage summary', async () => {
    get = fakeGet(true);
    renderReport();
    await waitFor(() =>
      expect(screen.getAllByText(/Tidak ada data laporan|No report data/i).length).toBeGreaterThan(
        0,
      ),
    );
    expect(screen.queryByRole('region', { name: 'Pemakaian per komponen' })).toBeNull();
  });
});
