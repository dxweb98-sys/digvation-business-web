import type * as BusinessRuntime from '@digvation/business-runtime';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CatalogItemTransactionsDetail } from '../api/reporting-api';
import { dataset, fakeGet, LOADED, renderReports } from './reporting-test-harness';

const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const VARIANT_ID = '22222222-2222-4222-8222-222222222222';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const ranking = dataset('catalog-performance', {
  summary: { finalRevenue: '266400.0000', saleLevelRefundAmount: '10000.0000' },
  items: [
    {
      rank: 1,
      catalogItemId: ITEM_ID,
      catalogVariantId: VARIANT_ID,
      itemCode: 'POM',
      itemName: 'Pomade — Standar',
      transactionCount: 4,
      refundedTransactionCount: 1,
      quantitySold: '6.0000',
      finalRevenue: '266400.0000',
      discountAmount: '0.0000',
      taxAmount: '26400.0000',
      averageSellingValue: '66600.0000',
    },
  ],
  total: 1,
});

const record = (
  index: number,
  quantity: string,
  refund: Partial<CatalogItemTransactionsDetail['records']['items'][number]> = {},
) => ({
  saleId: `33333333-3333-4333-8333-33333333333${index}`,
  saleNumber: `TRX-20261020-00000${index}`,
  invoiceNumber: `INV-20261020-00000${index}`,
  occurredAt: '2026-10-20T03:00:00.000Z',
  sellingLocation: 'Balaraja',
  quantity,
  grossAmount: `${Number(quantity) * 40000}.0000`,
  discountAmount: '0.0000',
  taxAmount: `${Number(quantity) * 4400}.0000`,
  lineAmount: `${Number(quantity) * 44400}.0000`,
  saleRefundAmount: '0.0000',
  refundState: 'NONE' as const,
  ...refund,
});

const detail = (page = 1): CatalogItemTransactionsDetail => ({
  item: {
    catalogItemId: ITEM_ID,
    catalogVariantId: VARIANT_ID,
    itemName: 'Pomade',
    variantName: 'Standar',
  },
  period: { dateFrom: '2026-10-20', dateTo: '2026-10-20', sellingLocationId: null },
  summary: {
    transactionCount: 4,
    quantitySold: '6.0000',
    grossRevenue: '240000.0000',
    discountAmount: '0.0000',
    taxAmount: '26400.0000',
    finalRevenue: '266400.0000',
  },
  records: {
    items:
      page === 1
        ? [
            record(1, '1'),
            record(2, '2', { saleRefundAmount: '10000.0000', refundState: 'PARTIAL' }),
            record(3, '1'),
            record(4, '2'),
          ]
        : [],
    total: 4,
    page,
    pageSize: 10,
  },
});

const api = vi.hoisted(() => ({
  client: null as null | { get: (url: string) => Promise<unknown> },
  permissions: [] as string[],
}));
vi.mock('@digvation/business-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof BusinessRuntime>()),
  useRuntime: () => ({ apiBaseUrl: '' }),
}));
vi.mock('../../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({
    createApiClient: () => api.client,
    getAccessToken: async () => 'token',
    session: {
      access: {
        permissions: api.permissions,
        products: ['POS'],
        capabilities: [],
        foundations: ['CATALOG'],
      },
    },
  }),
  isSessionExpiredError: () => false,
}));

afterEach(cleanup);

async function openDetail(permissions = ['catalog:read']) {
  api.permissions = permissions;
  const requests: string[] = [];
  const fake = fakeGet({ 'catalog-performance': ranking });
  api.client = {
    get: async (url: string) => {
      requests.push(url);
      const path = url.split('?')[0]!;
      if (path === `/api/v1/reports/catalog-performance/items/${ITEM_ID}/transactions`)
        return detail(Number(new URLSearchParams(url.split('?')[1]).get('page') ?? 1));
      return fake.get(url);
    },
  };
  renderReports('/?type=catalog-performance&dateFrom=2026-10-20&dateTo=2026-10-20');
  await screen.findAllByText('Pomade — Standar', undefined, LOADED);
  const row = screen
    .getAllByText('Pomade — Standar')
    .map((node) => node.closest('tr'))
    .find(Boolean)!;
  fireEvent.click(row.querySelector('[data-ds-component="dropdown-trigger"] > *')!);
  fireEvent.click((await screen.findAllByText('Lihat detail')).at(-1)!);
  const dialog = await screen.findByRole('dialog', { name: 'Detail kinerja katalog' });
  await within(dialog).findByText('Transaksi untuk item ini', undefined, LOADED);
  return { dialog: within(dialog), element: dialog, requests };
}

describe('Catalog performance detail', () => {
  it('explains transactions versus units on the report itself', async () => {
    api.permissions = ['catalog:read'];
    api.client = fakeGet({ 'catalog-performance': ranking });
    renderReports('/?type=catalog-performance&dateFrom=2026-10-20&dateTo=2026-10-20');
    await screen.findAllByText('Pomade — Standar', undefined, LOADED);
    expect(screen.getByText(/4 transaksi dapat menjual 6 unit/)).toBeTruthy();
    expect(screen.getAllByText('Unit terjual').length).toBeGreaterThan(0);
  });

  it('requests exactly the row, its variant and the report scope, and reconciles with the row', async () => {
    const { dialog, requests } = await openDetail();
    expect(requests.find((url) => url.includes('/catalog-performance/items/'))).toMatch(
      new RegExp(
        `catalogVariantId=${VARIANT_ID}.*page=1&pageSize=10|dateFrom=2026-10-20&dateTo=2026-10-20.*catalogVariantId=${VARIANT_ID}`,
      ),
    );
    expect(
      dialog.getByText(/4 transaksi menjual total 6 unit item ini pada periode ini\./),
    ).toBeTruthy();
    const summary = within(dialog.getByRole('region', { name: 'Ringkasan' }));
    expect(summary.getByText('4')).toBeTruthy();
    expect(summary.getByText('6')).toBeTruthy();
    expect(dialog.getAllByText(/Rp\s?266\.400/).length).toBeGreaterThan(0);
  });

  it('lists one record per transaction and discloses a sale-level refund without reducing the item', async () => {
    const { dialog, element } = await openDetail();
    const records = within(dialog.getByRole('region', { name: 'Transaksi untuk item ini' }));
    for (const index of [1, 2, 3, 4])
      expect(records.getAllByText(`TRX-20261020-00000${index}`).length).toBeGreaterThan(0);
    expect(records.getAllByText('Sebagian').length).toBeGreaterThan(0);
    // The table renders each record once per layout (table and stacked); 3 of 4 records have no refund.
    expect(records.getAllByText('Tidak ada').length % 3).toBe(0);
    expect(records.getAllByText('Sebagian').length * 3).toBe(
      records.getAllByText('Tidak ada').length,
    );
    expect(dialog.getByText(/Pengembalian dana berlaku untuk seluruh transaksi/)).toBeTruthy();
    expect(element.textContent).not.toMatch(UUID);
    expect(element.textContent).not.toMatch(/PARTIAL|NONE|FULL/);
  });

  it('opens the authoritative transaction only with completed-sale visibility', async () => {
    const { element } = await openDetail(['catalog:read']);
    const region = element.querySelector('[aria-label="Transaksi untuk item ini"]')!;
    expect(region.querySelector('[data-ds-component="dropdown-trigger"]')).toBeNull();
    cleanup();
    const allowed = await openDetail(['catalog:read', 'sales:read-completed']);
    await waitFor(() =>
      expect(
        allowed.element
          .querySelector('[aria-label="Transaksi untuk item ini"]')!
          .querySelector('[data-ds-component="dropdown-trigger"]'),
      ).not.toBeNull(),
    );
  });
});
