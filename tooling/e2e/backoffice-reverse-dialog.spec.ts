import { expect, test, type Page } from '@playwright/test';

import { BACKOFFICE_URL } from './servers';
import {
  testPayment,
  testSale,
} from '../../apps/backoffice/src/features/transaction-history/model/transaction-test-fixtures';

const locationId = '11111111-1111-4111-8111-111111111111';
const at = '2026-10-17T01:00:00.000Z';
const envelope = (data: unknown) => ({
  success: true,
  data,
  request_id: 'reverse-dialog',
  timestamp: at,
});

/** A finalized Sale paid 150,000 in cash; the money is still held. */
const sale = testSale({
  id: 'sale-cash',
  saleNumber: 'TRX-20261017-000001',
  status: 'FINALIZED',
  operationalState: 'COMPLETED',
  sellingLocationId: locationId,
  version: 5,
  grossAmount: '150000.0000',
  totalAmount: '150000.0000',
  finalizedAt: at,
  payments: [
    testPayment('cash-1', 'SUCCEEDED', '150000.0000', {
      method: 'CASH',
      financeFinancialAccountNameSnapshot: 'Kas Laci',
      financePaymentRouteId: 'route-cash',
    }),
  ],
});

const routes = [
  { id: 'route-cash', paymentMethod: 'CASH', currency: 'IDR', financialAccountName: 'Kas Laci' },
  {
    id: 'route-bank',
    paymentMethod: 'BANK_TRANSFER',
    currency: 'IDR',
    financialAccountName: 'Rekening BCA',
  },
  { id: 'route-qris', paymentMethod: 'QRIS', currency: 'IDR', financialAccountName: 'Akun QRIS' },
];

const BASE_PERMISSIONS = [
  'auth:self',
  'backoffice:access',
  'sales:read',
  'sales:read-completed',
  'catalog:read',
];

async function mockRuntime(
  page: Page,
  {
    permissions,
    reverseError,
  }: { permissions: string[]; reverseError?: { status: number; code: string } },
) {
  const writes: Array<{ path: string; body: unknown }> = [];
  await page.addInitScript(() => {
    const key = 'digvation.backoffice.auth-session.v2';
    sessionStorage.setItem(`${key}.access-token`, 'local-reverse-render');
    sessionStorage.setItem(`${key}.access-expires-at`, '2099-01-01T00:00:00.000Z');
    sessionStorage.setItem(`${key}.last-activity`, String(Date.now()));
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const method = route.request().method();
    if (method !== 'GET' && path !== '/auth/browser/refresh') {
      writes.push({ path, body: route.request().postDataJSON() });
      if (path.endsWith('/reverse') && reverseError) {
        await route.fulfill({
          status: reverseError.status,
          json: {
            success: false,
            error: { code: reverseError.code, message: 'refused' },
            request_id: 'r',
            timestamp: at,
          },
        });
        return;
      }
    }
    let data: unknown = { items: [], total: 0, limit: 20, offset: 0 };
    if (path === '/session/context')
      data = {
        identity: {
          userId: 'reverse-review',
          displayName: 'Review',
          username: 'review',
          roles: [],
        },
        business: { tenantId: locationId, name: 'Reverse Review', currency: 'IDR' },
        access: {
          products: ['POS'],
          capabilities: [],
          foundations: [
            'CUSTOMER_IDENTITY',
            'OPERATIONAL_ACCESS',
            'ORGANIZATION_LOCATION',
            'CATALOG',
          ],
          permissions,
        },
        preferences: {
          locale: 'id-ID',
          timezone: 'Asia/Jakarta',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: 'HH:mm',
        },
        deployment: { profile: 'DEDICATED' },
        contextVersion: 'reverse',
      };
    else if (path === '/operational-access/context')
      data = {
        organizationWide: true,
        resolution: 'AUTO_RESOLVED',
        selectedLocationId: locationId,
        mainLocationId: locationId,
        locations: [{ id: locationId, code: 'MAIN', name: 'Main Branch' }],
      };
    else if (path === '/sales/payment-routes') data = { items: routes };
    else if (path === '/sales' && method === 'GET')
      data = { items: [sale], total: 1, limit: 20, offset: 0 };
    else if (path === `/sales/${sale.id}` && method === 'GET') data = sale;
    else if (path.endsWith('/reverse') && method === 'POST')
      data = {
        ...sale,
        version: 6,
        reversal: { reason: 'x', reversedAt: at, reversedBy: 'Review' },
      };
    await route.fulfill({ json: envelope(data) });
  });
  return writes;
}

async function openDetail(page: Page, mobile: boolean) {
  await page.goto(`${BACKOFFICE_URL}/transactions`, { waitUntil: 'networkidle' });
  const trigger = mobile
    ? page
        .getByText('TRX-20261017-000001')
        .locator('xpath=ancestor::div[contains(@class,"justify-between")][1]')
        .locator('span:has(svg)')
        .first()
    : page
        .getByRole('row', { name: /TRX-20261017-000001/ })
        .locator('td')
        .last()
        .locator('button, span')
        .first();
  await trigger.click();
  await page.getByText('Lihat transaksi').click();
  return page.getByRole('dialog').first();
}

for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
] as const) {
  test(`reverses a paid transaction in one confirmed step (${name})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const writes = await mockRuntime(page, {
      permissions: [...BASE_PERMISSIONS, 'payments:refund', 'sales:reverse'],
    });
    const detail = await openDetail(page, name === 'mobile');
    await detail.getByRole('button', { name: 'Batalkan transaksi' }).click();

    const dialog = page.getByRole('dialog', { name: 'Batalkan transaksi' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Uang diterima yang dikembalikan/)).toBeVisible();
    await expect(dialog.getByText(/Rp\s?150\.000/)).toBeVisible();
    const submit = dialog.getByRole('button', { name: 'Kembalikan dana & batalkan' });
    await expect(submit).toBeDisabled();

    // Cancelling sends nothing.
    await dialog.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(dialog).toBeHidden();
    await detail.getByRole('button', { name: 'Batalkan transaksi' }).click();
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Alasan').fill('Transaksi salah input, uang dikembalikan');
    await expect(submit).toBeDisabled();
    await dialog.getByLabel('Dana dikembalikan melalui').click();
    // A QRIS route can receive money but never pays it out.
    await expect(page.getByRole('option', { name: /QRIS/ })).toHaveCount(0);
    await page.getByRole('option', { name: /Rekening BCA/ }).click();
    await expect(dialog.getByLabel('Referensi transfer')).toBeVisible();
    // Without confirming the money was really returned, nothing can be submitted.
    await expect(submit).toBeDisabled();
    await dialog.getByText('Uang sudah benar-benar dikembalikan ke pelanggan.').click();
    await expect(
      dialog.getByRole('checkbox', { name: /Uang sudah benar-benar dikembalikan/ }),
    ).toBeChecked();
    await expect(submit).toBeEnabled();
    expect(writes).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // Let the dialog and checkbox transitions settle so the capture shows the final state.
    await page.waitForTimeout(600);
    await page.screenshot({
      path: testInfo.outputPath(`reverse-dialog-${name}.png`),
      fullPage: true,
    });

    // The confirmation and the enabled action survive the full-page capture.
    await expect(
      dialog.getByRole('checkbox', { name: /Uang sudah benar-benar dikembalikan/ }),
    ).toBeChecked();
    await expect(submit).toBeEnabled();
    await submit.dblclick();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toEqual({
      path: `/sales/${sale.id}/reverse`,
      body: {
        expectedVersion: 5,
        reason: 'Transaksi salah input, uang dikembalikan',
        refundDisbursement: { method: 'BANK_TRANSFER', paymentRouteId: 'route-bank' },
        moneyReturned: true,
      },
    });
    await expect(page.getByText('Transaksi berhasil dibatalkan.')).toBeVisible();
  });
}

test('without the refund permission the reversal stays blocked with its reason', async ({
  page,
}) => {
  const writes = await mockRuntime(page, { permissions: [...BASE_PERMISSIONS, 'sales:reverse'] });
  const detail = await openDetail(page, false);
  await expect(detail.getByRole('button', { name: 'Batalkan transaksi' })).toBeDisabled();
  await expect(detail.getByText(/Uang yang benar-benar diterima harus dikembalikan/)).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Pengembalian dana' })).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('a Runtime refusal is shown in the dialog and nothing is reported as done', async ({
  page,
}) => {
  const writes = await mockRuntime(page, {
    permissions: [...BASE_PERMISSIONS, 'payments:refund', 'sales:reverse'],
    reverseError: { status: 409, code: 'SALE_VERSION_CONFLICT' },
  });
  const detail = await openDetail(page, false);
  await detail.getByRole('button', { name: 'Batalkan transaksi' }).click();
  const dialog = page.getByRole('dialog', { name: 'Batalkan transaksi' });
  await dialog.getByLabel('Alasan').fill('Pelanggan batal');
  await dialog.getByLabel('Dana dikembalikan melalui').click();
  await page.getByRole('option', { name: /Kas Laci/ }).click();
  await dialog.getByText('Uang sudah benar-benar dikembalikan ke pelanggan.').click();
  await expect(
    dialog.getByRole('checkbox', { name: /Uang sudah benar-benar dikembalikan/ }),
  ).toBeChecked();
  await dialog.getByRole('button', { name: 'Kembalikan dana & batalkan' }).click();
  await expect(
    dialog.getByText('Transaksi ini telah berubah. Muat ulang lalu coba lagi.'),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page.getByText('Transaksi berhasil dibatalkan.')).toHaveCount(0);
  expect(writes).toHaveLength(1);
});
