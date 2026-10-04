import type * as BusinessRuntime from '@digvation/business-runtime';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { dataset, fakeGet, LOADED, renderReports } from './reporting-test-harness';

const longName = 'Red Coloring Brand Professional Permanent Intense Copper Blend';

const usage = dataset('component-usage', {
  summary: {
    transactionCount: 3,
    componentCount: 2,
    usageCount: 4,
    fixedUsageCount: 2,
    selectedUsageCount: 2,
    billedAdditionAmount: '30000.0000',
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
        billedAmount: '30000.0000',
        services: [
          { label: 'Hair Color', quantity: '39.0000' },
          { label: 'Highlight', quantity: '7.0000' },
        ],
      } as never,
    ],
    breakdowns: {
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
      parentItemType: 'SERVICE',
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
      parentItemType: 'SERVICE',
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
});

const api = vi.hoisted(() => ({
  client: null as null | { get: (url: string) => Promise<unknown> },
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
        permissions: ['sales:read', 'catalog:read'],
        products: ['POS'],
        capabilities: [],
        foundations: [],
      },
    },
  }),
  isSessionExpiredError: () => false,
}));

const tableRow = (text: string) =>
  screen
    .getAllByText(text)
    .map((node) => node.closest('tr'))
    .find((row): row is HTMLTableRowElement => Boolean(row))!;

afterEach(cleanup);

describe('Component usage report', () => {
  const open = () => {
    const fake = fakeGet({ 'component-usage': usage });
    api.client = { get: fake.get };
    renderReports('/?type=component-usage&dateFrom=2026-09-01&dateTo=2026-09-30');
    return fake;
  };

  it('shows only the returned KPIs and the per-component usage split', async () => {
    open();
    const summary = within(await screen.findByRole('region', { name: 'Ringkasan' }, LOADED));
    expect(summary.getByText('Tambahan ditagihkan')).toBeTruthy();
    expect(summary.queryByText(/fixedUsageCount|Fixed Usage Count/)).toBeNull();
    const table = within(screen.getByRole('region', { name: 'Pemakaian per komponen' }));
    expect(table.getAllByText(longName).length).toBeGreaterThan(0);
    expect(table.getAllByText('46').length).toBeGreaterThan(0);
    expect(table.getAllByText('34').length).toBeGreaterThan(0);
    expect(table.getAllByText(/Hair Color 39 · Highlight 7/).length).toBeGreaterThan(0);
  });

  it('never prices a configured component and bills a selected addition from its snapshot', async () => {
    open();
    await screen.findAllByText('TRX-20260920-000001', undefined, LOADED);
    const fixed = tableRow('Developer 20 vol');
    const selected = tableRow('Red Coloring Brand');
    expect(fixed.textContent).not.toMatch(/Rp\s?\d/);
    expect(fixed.textContent).toContain('—');
    expect(within(fixed).getByText('Komponen terkonfigurasi')).toBeTruthy();
    expect(selected.textContent).toMatch(/Rp\s?30\.000/);
    expect(within(selected).getByText('Dipilih saat transaksi')).toBeTruthy();
    expect(screen.queryByText('FIXED_BOM')).toBeNull();
  });

  it('offers the source filter and a component search the Runtime applies', async () => {
    const fake = open();
    await screen.findAllByText('TRX-20260920-000001', undefined, LOADED);
    expect(screen.getAllByText('Sumber pemakaian').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Cari komponen atau layanan'), {
      target: { value: 'Red' },
    });
    await waitFor(() =>
      expect(fake.requests.at(-1)).toMatch(/\/reports\/component-usage\?.*search=Red.*page=1/),
    );
  });

  it('opens a read-only detail with the parent service, component, source, and usage', async () => {
    open();
    await screen.findAllByText('TRX-20260921-000002', undefined, LOADED);
    fireEvent.click(
      tableRow('Red Coloring Brand').querySelector('[data-ds-component="dropdown-trigger"] > *')!,
    );
    fireEvent.click((await screen.findAllByText('Lihat detail')).at(-1)!);
    const dialog = within(await screen.findByRole('dialog', { name: 'Detail pemakaian komponen' }));
    expect(dialog.getByRole('region', { name: 'Layanan induk' })).toBeTruthy();
    expect(dialog.getAllByText('Highlight').length).toBeGreaterThan(0);
    expect(dialog.getAllByText('Intense').length).toBeGreaterThan(0);
    expect(dialog.getByText(/Rp\s?10\.000/)).toBeTruthy();
    expect(dialog.getAllByText(/Rp\s?30\.000/).length).toBeGreaterThan(0);
    expect(dialog.getAllByRole('button').map((button) => button.textContent)).not.toContain('Ubah');
  });
});
