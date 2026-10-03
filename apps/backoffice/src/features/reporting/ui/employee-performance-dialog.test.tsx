import type * as BusinessRuntime from '@digvation/business-runtime';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EmployeeContributionDetail } from '../api/reporting-api';
import { dataset, fakeGet, LOADED, renderReports } from './reporting-test-harness';

const EMPLOYEE_ID = '66666666-6666-4666-8666-666666666666';
const SALE_ID = '77777777-7777-4777-8777-777777777777';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const longName = 'Citra Ayu Kusumawardhani Putri Pratiwi Senior Colorist';
const longService = 'Hair Coloring Premium Fashion Shade dengan Perawatan Keratin Intensif';

const ranking = dataset('employee-performance', {
  summary: { contributionRevenue: '180000.0000', employeeCount: 1 },
  items: [
    {
      rank: 2,
      employeeId: EMPLOYEE_ID,
      employeeCode: 'EMP-7',
      employeeName: longName,
      contributedTransactions: 2,
      contributedLineItems: 2,
      contributionRevenue: '180000.0000',
      averageContributionPerTransaction: '90000.0000',
      topCatalogItem: longService,
    },
  ],
  total: 1,
});

const detail = (page = 1): EmployeeContributionDetail => ({
  employee: {
    id: EMPLOYEE_ID,
    code: 'EMP-7',
    displayName: longName,
    currentPositionName: 'Senior Colorist',
    currentStatus: 'ACTIVE',
  },
  period: { dateFrom: '2026-09-01', dateTo: '2026-09-30', sellingLocationId: null },
  summary: {
    contributedTransactions: 2,
    contributedLineItems: 2,
    contributionRevenue: '180000.0000',
    averageContributionPerTransaction: '90000.0000',
  },
  trend: [
    { label: '2026-09-19', value: '130000.0000' },
    { label: '2026-09-20', value: '50000.0000' },
  ],
  services: [
    {
      label: longService,
      transactionCount: 1,
      workItemCount: 1,
      amount: '130000.0000',
      share: '0.722222',
      baseAmount: '100000.0000',
      additional: [{ label: 'Red Coloring BRAND · Copper', amount: '30000.0000' }],
    },
    {
      label: 'Potong Rambut',
      transactionCount: 1,
      workItemCount: 1,
      amount: '50000.0000',
      share: '0.277778',
      baseAmount: '50000.0000',
      additional: [],
    },
  ],
  records: {
    items:
      page === 1
        ? [
            {
              saleId: SALE_ID,
              saleNumber: 'TRX-20260920-000002',
              occurredAt: '2026-09-20T03:00:00.000Z',
              sellingLocation: 'Balaraja',
              serviceName: 'Potong Rambut',
              serviceVariantName: null,
              source: 'BASE_SERVICE',
              componentName: null,
              componentVariantName: null,
              amount: '50000.0000',
            },
            {
              saleId: SALE_ID,
              saleNumber: 'TRX-20260919-000001',
              occurredAt: '2026-09-19T03:00:00.000Z',
              sellingLocation: 'Balaraja',
              serviceName: longService,
              serviceVariantName: 'Panjang',
              source: 'ADDITIONAL_ITEM',
              componentName: 'Red Coloring BRAND',
              componentVariantName: 'Copper',
              amount: '30000.0000',
            },
          ]
        : [],
    total: 12,
    page,
    pageSize: 10,
  },
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
    // Employee Performance access only: no completed-sale visibility.
    session: {
      access: {
        permissions: ['employees:read'],
        products: ['POS'],
        capabilities: [],
        foundations: [],
      },
    },
  }),
  isSessionExpiredError: () => false,
}));

afterEach(cleanup);

async function openDetail() {
  const requests: string[] = [];
  const fake = fakeGet({ 'employee-performance': ranking });
  api.client = {
    get: async (url: string) => {
      requests.push(url);
      const path = url.split('?')[0]!;
      if (path === `/api/v1/reports/employee-performance/employees/${EMPLOYEE_ID}`)
        return detail(Number(new URLSearchParams(url.split('?')[1]).get('page') ?? 1));
      return fake.get(url);
    },
  };
  renderReports('/?type=employee-performance&dateFrom=2026-09-01&dateTo=2026-09-30');
  await screen.findAllByText(longName, undefined, LOADED);
  const row = screen
    .getAllByText(longName)
    .map((node) => node.closest('tr'))
    .find(Boolean)!;
  fireEvent.click(row.querySelector('[data-ds-component="dropdown-trigger"] > *')!);
  fireEvent.click((await screen.findAllByText('Lihat detail')).at(-1)!);
  const dialog = await screen.findByRole('dialog', { name: 'Detail kinerja karyawan' });
  await within(dialog).findByText('Kontribusi per layanan', undefined, LOADED);
  return { dialog: within(dialog), element: dialog, requests };
}

describe('Employee performance detail', () => {
  it('identifies the employee with current context kept apart, in the selected period', async () => {
    const { dialog, requests } = await openDetail();
    expect(dialog.getAllByText(longName).length).toBeGreaterThan(0);
    expect(dialog.getByText('EMP-7')).toBeTruthy();
    expect(dialog.getByText(/Jabatan saat ini: Senior Colorist/)).toBeTruthy();
    expect(dialog.getByText('Aktif')).toBeTruthy();
    expect(dialog.getByText(/Semua lokasi/)).toBeTruthy();
    expect(requests.find((url) => url.includes('/employees/'))).toMatch(
      /dateFrom=2026-09-01&dateTo=2026-09-30.*page=1&pageSize=10/,
    );
  });

  it('reconciles its KPIs with the ranking row and keeps the ranking rank', async () => {
    const { dialog } = await openDetail();
    const summary = within(dialog.getByRole('region', { name: 'Ringkasan' }));
    expect(summary.getAllByText('2')).toHaveLength(2);
    expect(summary.getByText(/Rp\s?90\.000/)).toBeTruthy();
    expect(summary.getByText('#2')).toBeTruthy();
    expect(dialog.getAllByText(/Rp\s?180\.000/).length).toBeGreaterThan(0);
  });

  it('breaks contribution down by Service, separating main work from additional items', async () => {
    const { dialog } = await openDetail();
    const services = within(dialog.getByRole('region', { name: 'Kontribusi per layanan' }));
    expect(services.getByText(longService)).toBeTruthy();
    expect(services.getByText('Potong Rambut')).toBeTruthy();
    expect(services.getAllByText('Layanan utama')).toHaveLength(2);
    expect(services.getByText('Item tambahan · Red Coloring BRAND · Copper')).toBeTruthy();
    expect(services.getByText(/72,2%/)).toBeTruthy();
  });

  it('lists contribution records with transaction numbers, work origin, and no ids', async () => {
    const { dialog, element, requests } = await openDetail();
    const records = within(dialog.getByRole('region', { name: 'Rincian kontribusi' }));
    expect(records.getAllByText('TRX-20260919-000001').length).toBeGreaterThan(0);
    expect(
      records.getAllByText(/Item tambahan · Red Coloring BRAND · Copper/).length,
    ).toBeGreaterThan(0);
    expect(records.getAllByText('Kontribusi').length).toBeGreaterThan(0);
    expect(element.textContent).not.toMatch(UUID);
    expect(element.textContent).not.toMatch(/BASE_SERVICE|ADDITIONAL_ITEM|ACTIVE/);
    fireEvent.click(records.getAllByRole('button', { name: 'Halaman 2' })[0]!);
    await waitFor(() => expect(requests.at(-1)).toMatch(/\/employees\/.*page=2&pageSize=10/));
  });
});

describe('Employee performance detail reliability', () => {
  const OTHER_ID = '88888888-8888-4888-8888-888888888888';
  const twoEmployees = dataset('employee-performance', {
    items: [
      ranking.items[0]!,
      {
        ...ranking.items[0]!,
        rank: 3,
        employeeId: OTHER_ID,
        employeeCode: 'EMP-9',
        employeeName: 'Bagas Pratama',
      },
    ],
    total: 2,
  });
  const other = (): EmployeeContributionDetail => ({
    ...detail(),
    employee: { ...detail().employee, id: OTHER_ID, code: 'EMP-9', displayName: 'Bagas Pratama' },
  });

  /** A controllable Runtime: each detail call resolves or rejects only when the test says so. */
  function controlled() {
    const calls: {
      url: string;
      resolve: (value: unknown) => void;
      reject: (error: unknown) => void;
    }[] = [];
    const fake = fakeGet({ 'employee-performance': twoEmployees });
    api.client = {
      get: (url: string) =>
        url.includes('/employees/')
          ? new Promise((resolve, reject) => calls.push({ url, resolve, reject }))
          : fake.get(url),
    };
    renderReports('/?type=employee-performance&dateFrom=2026-09-01&dateTo=2026-09-30');
    return calls;
  }

  async function openRow(name: string) {
    await screen.findAllByText(name, undefined, LOADED);
    const row = screen
      .getAllByText(name)
      .map((node) => node.closest('tr'))
      .find(Boolean)!;
    fireEvent.click(row.querySelector('[data-ds-component="dropdown-trigger"] > *')!);
    fireEvent.click((await screen.findAllByText('Lihat detail')).at(-1)!);
    return within(await screen.findByRole('dialog', { name: 'Detail kinerja karyawan' }));
  }

  const close = (dialog: ReturnType<typeof within>) =>
    fireEvent.click(dialog.getAllByRole('button', { name: 'Tutup' }).at(-1)!);

  it('shows a bounded loading state, then the content, never an endless loading line', async () => {
    const calls = controlled();
    const dialog = await openRow(longName);
    expect(dialog.getByRole('status', { name: 'Memuat kontribusi…' })).toBeTruthy();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.url).toBe(
      `/api/v1/reports/employee-performance/employees/${EMPLOYEE_ID}?dateFrom=2026-09-01&dateTo=2026-09-30&page=1&pageSize=10`,
    );
    calls[0]!.resolve(detail());
    await dialog.findByText('Kontribusi per layanan');
    expect(dialog.queryByRole('status', { name: 'Memuat kontribusi…' })).toBeNull();
  });

  it('turns a failed read into the shared connection error, and Retry recovers', async () => {
    const calls = controlled();
    const dialog = await openRow(longName);
    await waitFor(() => expect(calls).toHaveLength(1));
    calls[0]!.reject({ status: 500, code: 'UNKNOWN_API_ERROR' });
    // One automatic retry, then the error is shown instead of a spinner.
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 5000 });
    calls[1]!.reject({ status: 500, code: 'UNKNOWN_API_ERROR' });
    expect(
      await dialog.findByText('Kontribusi karyawan ini tidak dapat dimuat.', undefined, LOADED),
    ).toBeTruthy();
    expect(dialog.queryByRole('status', { name: 'Memuat kontribusi…' })).toBeNull();
    expect(dialog.getAllByRole('button', { name: 'Tutup' }).length).toBeGreaterThan(0);
    fireEvent.click(dialog.getByRole('button', { name: /Coba lagi/i }));
    await waitFor(() => expect(calls).toHaveLength(3));
    calls[2]!.resolve(detail());
    expect(await dialog.findByText('Kontribusi per layanan')).toBeTruthy();
  });

  it('never shows the previous employee while another one loads, and reopens cleanly', async () => {
    const calls = controlled();
    let dialog = await openRow(longName);
    await waitFor(() => expect(calls).toHaveLength(1));
    calls[0]!.resolve(detail());
    await dialog.findByText('Kontribusi per layanan');
    close(dialog);

    dialog = await openRow('Bagas Pratama');
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]!.url).toContain(`/employees/${OTHER_ID}?`);
    // While Bagas loads, nothing of the previous employee is presented.
    expect(dialog.queryByText(longName)).toBeNull();
    expect(dialog.getByRole('status', { name: 'Memuat kontribusi…' })).toBeTruthy();
    calls[1]!.resolve(other());
    expect(await dialog.findByText('EMP-9')).toBeTruthy();
    close(dialog);

    // Reopening the first employee serves its own cached detail immediately.
    dialog = await openRow(longName);
    expect(await dialog.findByText('Kontribusi per layanan')).toBeTruthy();
    expect(dialog.queryByText('Bagas Pratama')).toBeNull();
  });
});
