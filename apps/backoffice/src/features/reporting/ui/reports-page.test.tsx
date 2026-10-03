import type * as BusinessRuntime from '@digvation/business-runtime';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReportDataset } from '../api/reporting-api';
import { dataset, fakeGet, LOADED, renderReports } from './reporting-test-harness';

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
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
        permissions: auth.permissions,
        products: ['POS'],
        capabilities: [],
        foundations: [],
      },
    },
  }),
  isSessionExpiredError: () => false,
}));

function open(
  url: string,
  permissions: string[],
  datasets: Partial<Record<ReportDataset['type'], ReportDataset>> = {},
  extra: Record<string, unknown> = {},
) {
  auth.permissions = permissions;
  const fake = fakeGet(datasets, extra);
  api.client = { get: fake.get };
  renderReports(url);
  return fake;
}

const reportOptions = async () => {
  fireEvent.click(screen.getAllByRole('button', { name: /Jenis laporan/ })[0]!);
  return (await screen.findAllByRole('option')).map((option) => option.textContent);
};

const tableRow = (text: string) =>
  screen
    .getAllByText(text)
    .map((node) => node.closest('tr'))
    .find((row): row is HTMLTableRowElement => Boolean(row))!;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('Report catalog in the selector', () => {
  it('lists only the current reports the session may open, in business order', async () => {
    open('/?type=business-performance', [
      'sales:read',
      'tax:read',
      'payments:read',
      'expenses:read',
      'settlements:read',
      'reconciliations:read',
    ]);
    expect(await reportOptions()).toEqual([
      'Ringkasan Kinerja Bisnis',
      'Laporan Transaksi',
      'Pemakaian Komponen',
      'Laporan Pembayaran',
      'Laporan Pengeluaran',
      'Laporan Pajak',
    ]);
    expect(screen.queryByText(/Settlement|Penyelesaian|Rekonsiliasi|Reconciliation/)).toBeNull();
  });

  it('shows the Tax report for Tax visibility and hides it for Sale visibility alone', async () => {
    open('/?type=tax', ['sales:read']);
    expect(await reportOptions()).not.toContain('Laporan Pajak');
    cleanup();
    open('/?type=tax', ['tax:read']);
    expect(await reportOptions()).toEqual(['Laporan Pajak']);
  });
});

describe('Report hierarchy', () => {
  it('renders only returned KPIs, no fake chart, and no record table for business performance', async () => {
    open('/?type=business-performance', ['sales:read'], {
      'business-performance': dataset('business-performance', {
        summary: { finalRevenue: '250000.0000', transactionCount: 2, internalCounter: 9 },
        items: [{ occurredAt: '2026-10-01T03:00:00.000Z', finalRevenue: '250000.0000' }],
        total: 1,
      }),
    });
    const summary = within(await screen.findByRole('region', { name: 'Ringkasan' }, LOADED));
    expect(summary.getByText('Pendapatan')).toBeTruthy();
    expect(summary.getByText('Transaksi')).toBeTruthy();
    expect(summary.queryByText('Rata-rata transaksi')).toBeNull();
    expect(summary.queryByText(/internal/i)).toBeNull();
    expect(screen.queryByText('Tren pendapatan')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Rincian data' })).toBeNull();
  });

  it('switching reports resets filters, restarts paging, and never shows stale metrics', async () => {
    const fake = open('/?type=expenses', ['expenses:read', 'cash:read'], {
      expenses: dataset('expenses', {
        summary: { approvedExpenseTotal: '50000.0000', expenseCount: 1 },
        items: [
          {
            occurredAt: '2026-10-01T03:00:00.000Z',
            sellingLocation: 'Cabang utama',
            status: 'APPROVED',
            amount: '50000.0000',
          },
        ],
        total: 1,
      }),
      cash: dataset('cash', { summary: { movementCount: 3 }, total: 0 }),
    });
    await screen.findByText('Pengeluaran disetujui', undefined, LOADED);
    fireEvent.click(screen.getAllByRole('button', { name: /^Status/ })[0]!);
    fireEvent.click(await screen.findByRole('option', { name: 'Disetujui' }));
    await waitFor(() => expect(fake.requests.at(-1)).toContain('status=APPROVED'));

    fireEvent.click(screen.getAllByRole('button', { name: /Jenis laporan/ })[0]!);
    fireEvent.click(await screen.findByRole('option', { name: 'Pergerakan Kas' }));
    expect(await screen.findByText('Pergerakan')).toBeTruthy();
    expect(screen.queryByText('Pengeluaran disetujui')).toBeNull();
    const cashRequest = fake.requests.filter((url) => url.includes('/reports/cash')).at(-1)!;
    expect(cashRequest).not.toContain('status=');
    expect(cashRequest).toContain('page=1');
  });
});

describe('Payment report', () => {
  const payments = dataset('payments', {
    summary: {
      successfulAmount: '60000.0000',
      successfulPayments: 1,
      refundedAmount: '40000.0000',
      failedPayments: 0,
    },
    items: [
      {
        saleNumber: 'TRX-1',
        invoiceNumber: 'INV-1',
        occurredAt: '2026-10-01T03:00:00.000Z',
        sellingLocation: 'Cabang utama',
        kind: 'PAYMENT',
        method: 'CASH',
        status: 'SUCCEEDED',
        financialAccount: 'Kas Utama',
        currency: 'IDR',
        appliedAmount: '100000.0000',
        tenderedAmount: '100000.0000',
        changeAmount: '0.0000',
        providerReference: null,
        terminalAt: '2026-10-01T03:00:00.000Z',
      },
      {
        saleNumber: 'TRX-2',
        invoiceNumber: 'INV-2',
        occurredAt: '2026-10-01T04:00:00.000Z',
        sellingLocation: 'Cabang utama',
        kind: 'REFUND',
        method: 'CASH',
        status: 'SUCCEEDED',
        financialAccount: 'Kas Utama',
        currency: 'IDR',
        appliedAmount: '-40000.0000',
        tenderedAmount: '0.0000',
        changeAmount: '0.0000',
        providerReference: 'REFUND:abc',
        terminalAt: '2026-10-01T04:00:00.000Z',
      },
    ],
    total: 2,
  });

  it('presents a refund as its own fact and opens a read-only payment detail', async () => {
    open('/?type=payments', ['payments:read'], { payments });
    await screen.findAllByText('TRX-2', undefined, LOADED);
    const refund = tableRow('TRX-2');
    expect(within(refund).getByText('Pengembalian dana')).toBeTruthy();
    expect(within(refund).queryByText('Berhasil')).toBeNull();
    expect(refund.textContent).toMatch(/−\s?Rp\s?40\.000/);

    fireEvent.click(refund.querySelector('[data-ds-component="dropdown-trigger"] > *')!);
    fireEvent.click((await screen.findAllByText('Lihat detail')).at(-1)!);
    const dialog = within(await screen.findByRole('dialog', { name: 'Detail pengembalian dana' }));
    expect(dialog.getByText(/mengembalikan uang dari pembayaran berhasil sebelumnya/)).toBeTruthy();
    expect(dialog.getAllByText('INV-2').length).toBeGreaterThan(0);
    expect(dialog.queryByText('REFUND:abc')).toBeNull();
    expect(dialog.getAllByRole('button').map((button) => button.textContent)).toEqual(
      expect.not.arrayContaining(['Kembalikan dana', 'Reversal transaksi']),
    );
  });
});

describe('Tax report', () => {
  it('shows the captured tax with a readable rate and opens the tax detail', async () => {
    open('/?type=tax', ['tax:read'], {
      tax: dataset('tax', {
        summary: {
          taxableBase: '100000.0000',
          taxAmount: '11000.0000',
          includedTax: '0.0000',
          excludedTax: '11000.0000',
        },
        items: [
          {
            saleNumber: 'TRX-9',
            invoiceNumber: 'INV-9',
            occurredAt: '2026-10-01T03:00:00.000Z',
            sellingLocation: 'Cabang utama',
            itemCode: 'HC',
            itemName: 'Hair Color',
            variantName: null,
            quantity: '1.0000',
            taxCode: 'PPN',
            taxName: 'Pajak Pertambahan Nilai',
            taxRate: '0.110000',
            taxTreatment: 'EXCLUDED',
            taxableBase: '100000.0000',
            taxAmount: '11000.0000',
            includedTax: '0.0000',
            excludedTax: '11000.0000',
          },
        ],
        total: 1,
      }),
    });
    await screen.findAllByText('TRX-9', undefined, LOADED);
    const row = tableRow('TRX-9');
    expect(within(row).getByText('11%')).toBeTruthy();
    expect(row.textContent).not.toContain('0.110000');
    fireEvent.click(row.querySelector('[data-ds-component="dropdown-trigger"] > *')!);
    fireEvent.click((await screen.findAllByText('Lihat detail')).at(-1)!);
    const dialog = within(await screen.findByRole('dialog', { name: 'Detail pajak' }));
    expect(dialog.getByText('Pajak Pertambahan Nilai')).toBeTruthy();
    expect(dialog.getAllByText('Ditambahkan ke harga').length).toBeGreaterThan(0);
  });
});

describe('Transaction report detail', () => {
  const transactions = dataset('transactions', {
    summary: { transactionCount: 1 },
    items: [
      {
        saleId: 'sale-1',
        saleNumber: 'TRX-20261001-000001',
        invoiceNumber: null,
        occurredAt: '2026-10-01T03:00:00.000Z',
        sellingLocation: 'Cabang utama',
        saleStatus: 'FINALIZED',
        reversed: 'YES',
        total: '250000.0000',
        paymentStatuses: 'CASH:SUCCEEDED',
        fulfillmentStatuses: 'COMPLETED',
      },
    ],
    total: 1,
  });

  it('reuses the authoritative transaction detail and agrees on the reversed status', async () => {
    const fake = open(
      '/?type=transactions',
      ['sales:read', 'sales:read-completed'],
      { transactions },
      {
        '/api/v1/sales/sale-1': {
          id: 'sale-1',
          saleNumber: 'TRX-20261001-000001',
          invoiceNumber: null,
          sellingLocationId: 'l',
          currency: 'IDR',
          status: 'FINALIZED',
          version: 1,
          grossAmount: '250000.0000',
          totalAmount: '250000.0000',
          taxAmount: '0.0000',
          discountAmount: '0.0000',
          createdAt: '2026-10-01T03:00:00.000Z',
          finalizedAt: null,
          voidedAt: null,
          reversal: { reason: 'Komplain', reversedAt: '2026-10-01T05:00:00.000Z' },
          lines: [],
          payments: [],
        },
      },
    );
    await screen.findAllByText('TRX-20261001-000001', undefined, LOADED);
    const row = tableRow('TRX-20261001-000001');
    expect(within(row).getByText('Direversal')).toBeTruthy();
    expect(row.textContent).not.toContain('CASH:SUCCEEDED');
    fireEvent.click(row.querySelector('[data-ds-component="dropdown-trigger"] > *')!);
    fireEvent.click((await screen.findAllByText('Lihat detail')).at(-1)!);
    const dialog = within(await screen.findByRole('dialog', { name: 'Detail transaksi' }));
    expect(await dialog.findByText('Komplain')).toBeTruthy();
    expect(fake.requests).toContain('/api/v1/sales/sale-1');
    expect(dialog.queryByRole('button', { name: 'Kembalikan dana' })).toBeNull();
    expect(dialog.queryByRole('button', { name: 'Reversal transaksi' })).toBeNull();
  });

  it('offers no detail action without full completed-sale visibility, nor on aggregate reports', async () => {
    open('/?type=transactions', ['sales:read'], { transactions });
    await screen.findAllByText('TRX-20261001-000001', undefined, LOADED);
    expect(
      tableRow('TRX-20261001-000001').querySelector('[data-ds-component="dropdown-trigger"]'),
    ).toBeNull();
    cleanup();
    open('/?type=catalog-performance', ['catalog:read'], {
      'catalog-performance': dataset('catalog-performance', {
        summary: { finalRevenue: '1.0000' },
        items: [
          {
            rank: 1,
            itemCode: 'HC',
            itemName: 'Hair Color',
            transactionCount: 1,
            quantitySold: '1.5000',
            finalRevenue: '1.0000',
          },
        ],
        total: 1,
      }),
    });
    await screen.findAllByText('Hair Color', undefined, LOADED);
    const row = tableRow('Hair Color');
    expect(row.querySelector('[data-ds-component="dropdown-trigger"]')).toBeNull();
    expect(within(row).getByText('1,5')).toBeTruthy();
  });
});

describe('Readable actors', () => {
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const at = '2026-10-01T03:00:00.000Z';

  it('transactions show who created the Sale, with an intentional fallback', async () => {
    open('/?type=transactions', ['sales:read'], {
      transactions: dataset('transactions', {
        items: [
          {
            saleId: 's1',
            saleNumber: 'TRX-1',
            occurredAt: at,
            sellingLocation: 'Balaraja',
            saleStatus: 'FINALIZED',
            reversed: 'NO',
            total: '1.0000',
            createdBy: 'Rina Kasir',
            createdByPresence: 'USER',
          },
          {
            saleId: 's2',
            saleNumber: 'TRX-2',
            occurredAt: at,
            sellingLocation: 'Balaraja',
            saleStatus: 'FINALIZED',
            reversed: 'NO',
            total: '1.0000',
            createdBy: null,
            createdByPresence: 'UNAVAILABLE',
          },
        ],
        total: 2,
      }),
    });
    await screen.findAllByText('TRX-1', undefined, LOADED);
    expect(screen.getAllByText('Dibuat oleh').length).toBeGreaterThan(0);
    expect(within(tableRow('TRX-1')).getByText('Rina Kasir')).toBeTruthy();
    expect(within(tableRow('TRX-2')).getByText('Akun tidak tersedia')).toBeTruthy();
  });

  it('payments show who processed the payment; expenses who recorded and decided', async () => {
    open('/?type=payments', ['payments:read'], {
      payments: dataset('payments', {
        items: [
          {
            saleNumber: 'TRX-3',
            occurredAt: at,
            sellingLocation: 'Balaraja',
            kind: 'PAYMENT',
            method: 'CASH',
            status: 'SUCCEEDED',
            appliedAmount: '1.0000',
            processedBy: null,
            processedByPresence: 'SYSTEM',
          },
        ],
        total: 1,
      }),
    });
    await screen.findAllByText('TRX-3', undefined, LOADED);
    expect(screen.getAllByText('Diproses oleh').length).toBeGreaterThan(0);
    expect(within(tableRow('TRX-3')).getByText('Sistem')).toBeTruthy();
    cleanup();
    open('/?type=expenses', ['expenses:read'], {
      expenses: dataset('expenses', {
        items: [
          {
            occurredAt: at,
            sellingLocation: 'Balaraja',
            financialAccount: 'Kas',
            status: 'APPROVED',
            amount: '5.0000',
            note: 'Listrik bulanan',
            recordedBy: 'Rina Kasir',
            recordedByPresence: 'USER',
            decidedBy: 'Budi Manajer',
            decidedByPresence: 'USER',
          },
        ],
        total: 1,
      }),
    });
    await screen.findAllByText('Listrik bulanan', undefined, LOADED);
    const row = tableRow('Listrik bulanan');
    expect(within(row).getByText('Rina Kasir')).toBeTruthy();
    expect(within(row).getByText('Budi Manajer')).toBeTruthy();
    expect(screen.getAllByText('Diputuskan oleh').length).toBeGreaterThan(0);
    expect(row.textContent).not.toMatch(UUID);
  });

  it('attendance shows who recorded it, and who changed it afterwards as secondary audit', async () => {
    open('/?type=attendance', ['attendance:read'], {
      attendance: dataset('attendance', {
        items: [
          {
            attendanceDate: '2026-10-01',
            employeeName: 'Andi',
            employeeCode: 'EMP-1',
            status: 'PRESENT',
            source: 'LOCAL',
            recordedBy: 'Rina Kasir',
            recordedByPresence: 'USER',
            updatedBy: 'Budi Manajer',
            updatedByPresence: 'USER',
          },
        ],
        total: 1,
      }),
    });
    await screen.findAllByText('Andi', undefined, LOADED);
    const row = tableRow('Andi');
    expect(within(row).getByText('Rina Kasir')).toBeTruthy();
    expect(row.textContent).toContain('Diperbarui oleh: Budi Manajer');
  });
});

describe('Export language', () => {
  it('asks the Runtime for the file in the active Backoffice language', async () => {
    const fetch = vi.fn(async () => new Response(new Blob(['x'])));
    vi.stubGlobal('fetch', fetch);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    open('/?type=payments&dateFrom=2026-09-01&dateTo=2026-09-30', ['payments:read']);
    fireEvent.click((await screen.findAllByRole('button', { name: /Ekspor/ }))[0]!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Excel (.xlsx)' }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const url = String((fetch.mock.calls[0] as unknown[])[0]);
    expect(url).toMatch(/\/reports\/payments\/export\.xlsx\?.*dateFrom=2026-09-01.*locale=id/);
    vi.unstubAllGlobals();
  });
});

describe('Detail dialogs never wait on a request that cannot be made', () => {
  const unavailable = /Detail data ini tidak tersedia/;
  const openFirstDetail = async (text: string) => {
    await screen.findAllByText(text, undefined, LOADED);
    fireEvent.click(tableRow(text).querySelector('[data-ds-component="dropdown-trigger"] > *')!);
    fireEvent.click((await screen.findAllByText('Lihat detail')).at(-1)!);
  };

  it('explains a transaction row without its Sale identity instead of loading forever', async () => {
    const fake = open('/?type=transactions', ['sales:read', 'sales:read-completed'], {
      transactions: dataset('transactions', {
        items: [
          {
            saleNumber: 'TRX-OLD',
            occurredAt: '2026-10-01T03:00:00.000Z',
            sellingLocation: 'Balaraja',
            saleStatus: 'FINALIZED',
            total: '1.0000',
          },
        ],
        total: 1,
      }),
    });
    await openFirstDetail('TRX-OLD');
    const dialog = within(await screen.findByRole('dialog', { name: 'Detail transaksi' }));
    expect(dialog.getByText(unavailable)).toBeTruthy();
    expect(fake.requests.some((url) => url.startsWith('/api/v1/sales/'))).toBe(false);
  });

  it('explains an employee row without its employee identity instead of loading forever', async () => {
    const fake = open('/?type=employee-performance', ['employees:read'], {
      'employee-performance': dataset('employee-performance', {
        items: [
          {
            rank: 1,
            employeeCode: 'EMP-1',
            employeeName: 'Rindu Putri',
            contributedTransactions: 1,
            contributedLineItems: 1,
            contributionRevenue: '1.0000',
            averageContributionPerTransaction: '1.0000',
            topCatalogItem: 'Hair Color',
          },
        ],
        total: 1,
      }),
    });
    await openFirstDetail('Rindu Putri');
    const dialog = within(await screen.findByRole('dialog', { name: 'Detail kinerja karyawan' }));
    expect(dialog.getByText(unavailable)).toBeTruthy();
    expect(dialog.queryByText('Memuat kontribusi…')).toBeNull();
    expect(fake.requests.some((url) => url.includes('/employees/'))).toBe(false);
  });
});

describe('Transaction detail from Reporting', () => {
  it('reports a failed Sale read with Retry instead of loading forever, then recovers', async () => {
    auth.permissions = ['sales:read', 'sales:read-completed'];
    let failures = 1;
    const calls: string[] = [];
    const sale = {
      id: 'sale-9',
      saleNumber: 'TRX-9',
      invoiceNumber: null,
      sellingLocationId: 'l',
      currency: 'IDR',
      status: 'FINALIZED',
      version: 1,
      grossAmount: '1.0000',
      totalAmount: '1.0000',
      taxAmount: '0.0000',
      discountAmount: '0.0000',
      createdAt: '2026-10-01T03:00:00.000Z',
      finalizedAt: null,
      voidedAt: null,
      reversal: null,
      lines: [],
      payments: [],
    };
    const fake = fakeGet({
      transactions: dataset('transactions', {
        items: [
          {
            saleId: 'sale-9',
            saleNumber: 'TRX-9',
            occurredAt: '2026-10-01T03:00:00.000Z',
            sellingLocation: 'Balaraja',
            saleStatus: 'FINALIZED',
            reversed: 'NO',
            total: '1.0000',
          },
        ],
        total: 1,
      }),
    });
    api.client = {
      get: async (url: string) => {
        if (url.startsWith('/api/v1/sales/')) calls.push(url);
        if (url.startsWith('/api/v1/sales/sale-9')) {
          if (failures-- > 0) throw { status: 503, code: 'SERVICE_UNAVAILABLE' };
          return sale;
        }
        return fake.get(url);
      },
    };
    renderReports('/?type=transactions');
    await screen.findAllByText('TRX-9', undefined, LOADED);
    fireEvent.click(tableRow('TRX-9').querySelector('[data-ds-component="dropdown-trigger"] > *')!);
    fireEvent.click((await screen.findAllByText('Lihat detail')).at(-1)!);
    const dialog = within(await screen.findByRole('dialog', { name: 'Detail transaksi' }));
    expect(
      await dialog.findByText(
        /Detail transaksi tidak dapat dimuat|Could not load transaction details/,
        undefined,
        { timeout: 6000 },
      ),
    ).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: /Coba lagi/i }));
    expect(await dialog.findAllByText('TRX-9', undefined, LOADED)).not.toHaveLength(0);
    expect(calls).toEqual(['/api/v1/sales/sale-9', '/api/v1/sales/sale-9']);
    expect(dialog.queryByRole('button', { name: 'Kembalikan dana' })).toBeNull();
  }, 20_000);
});
