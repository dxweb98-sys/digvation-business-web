import { expect, test, type Page } from '@playwright/test';

import { BACKOFFICE_URL } from './servers';
import {
  testPayment,
  testSale,
} from '../../apps/backoffice/src/features/transaction-history/model/transaction-test-fixtures';

const locationId = '11111111-1111-4111-8111-111111111111';
const at = '2026-10-16T01:00:00.000Z';
const envelope = (data: unknown) => ({
  success: true,
  data,
  request_id: 'refund-dialog-render',
  timestamp: at,
});

/** A finalized Sale paid 150,000 by QRIS into the QRIS account; its own route is not a payout. */
const sale = testSale({
  id: 'sale-qris',
  saleNumber: 'TRX-20261016-000001',
  status: 'FINALIZED',
  operationalState: 'COMPLETED',
  sellingLocationId: locationId,
  version: 4,
  grossAmount: '150000.0000',
  totalAmount: '150000.0000',
  finalizedAt: at,
  payments: [
    testPayment('qris-a', 'SUCCEEDED', '150000.0000', {
      method: 'QRIS',
      financeFinancialAccountNameSnapshot: 'Akun QRIS A',
      financePaymentRouteId: 'route-qris-a',
    }),
  ],
});

const routes = [
  {
    id: 'route-qris-a',
    paymentMethod: 'QRIS',
    currency: 'IDR',
    financialAccountName: 'Akun QRIS A',
  },
  {
    id: 'route-bank-b',
    paymentMethod: 'BANK_TRANSFER',
    currency: 'IDR',
    financialAccountName: 'Rekening B',
  },
  {
    id: 'route-cash',
    paymentMethod: 'CASH',
    currency: 'IDR',
    financialAccountName: 'Kas Utama',
  },
];

async function mockRuntime(page: Page) {
  const refunds: unknown[] = [];
  await page.addInitScript(() => {
    const key = 'digvation.backoffice.auth-session.v2';
    sessionStorage.setItem(`${key}.access-token`, 'local-refund-render');
    sessionStorage.setItem(`${key}.access-expires-at`, '2099-01-01T00:00:00.000Z');
    sessionStorage.setItem(`${key}.last-activity`, String(Date.now()));
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const method = route.request().method();
    let data: unknown = { items: [], total: 0, limit: 20, offset: 0 };
    if (path === '/session/context')
      data = {
        identity: { userId: 'refund-review', displayName: 'Review', username: 'review', roles: [] },
        business: { tenantId: locationId, name: 'Refund Review', currency: 'IDR' },
        access: {
          products: ['POS'],
          capabilities: [],
          foundations: [
            'CUSTOMER_IDENTITY',
            'OPERATIONAL_ACCESS',
            'ORGANIZATION_LOCATION',
            'CATALOG',
          ],
          permissions: [
            'auth:self',
            'backoffice:access',
            'sales:read',
            'sales:read-completed',
            'payments:refund',
            'sales:reverse',
            'catalog:read',
          ],
        },
        preferences: {
          locale: 'id-ID',
          timezone: 'Asia/Jakarta',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: 'HH:mm',
        },
        deployment: { profile: 'DEDICATED' },
        contextVersion: 'refund',
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
    else if (path.endsWith('/refund') && method === 'POST') {
      refunds.push(route.request().postDataJSON());
      data = sale;
    }
    await route.fulfill({ json: envelope(data) });
  });
  return refunds;
}

for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
] as const) {
  test(`refunds QRIS money through a chosen bank account (${name})`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const refunds = await mockRuntime(page);
    await page.goto(`${BACKOFFICE_URL}/transactions`, { waitUntil: 'networkidle' });

    // The row (desktop) or card (mobile) action menu is the list's way into the detail.
    const trigger =
      name === 'desktop'
        ? page
            .getByRole('row', { name: /TRX-20261016-000001/ })
            .locator('td')
            .last()
            .locator('button, span')
            .first()
        : page
            .getByText('TRX-20261016-000001')
            .locator('xpath=ancestor::div[contains(@class,"justify-between")][1]')
            .locator('span:has(svg)')
            .first();
    await trigger.click();
    await page.getByText('Lihat transaksi').click();
    const detail = page.getByRole('dialog').first();
    await expect(detail.getByRole('button', { name: 'Pengembalian dana' })).toBeVisible();
    // Reversal is its own action: for a user who may return money it returns what is still held
    // in one confirmed step (backoffice-reverse-dialog.spec.ts); a standalone refund stays here.
    await expect(detail.getByRole('button', { name: 'Batalkan transaksi' })).toBeEnabled();
    await detail.getByRole('button', { name: 'Pengembalian dana' }).click();

    const dialog = page.getByRole('dialog', { name: 'Kembalikan pembayaran' });
    await expect(dialog).toBeVisible();
    const submit = dialog.getByRole('button', { name: 'Pengembalian dana' });
    await expect(submit).toBeDisabled();

    await dialog.getByLabel('Dana dikembalikan melalui').click();
    // A QRIS route can receive money but never pays it out.
    await expect(page.getByRole('option', { name: /QRIS/ })).toHaveCount(0);
    await expect(page.getByRole('option', { name: /Rekening B/ })).toBeVisible();
    await page.getByRole('option', { name: /Rekening B/ }).click();

    // The impact is shown before confirming: the account the money leaves from.
    await expect(dialog.getByText('Rekening B').first()).toBeVisible();
    await expect(
      dialog.getByText('Pembayaran asal tetap tercatat pada rekeningnya sendiri.'),
    ).toBeVisible();
    // A human explanation is required before the refund can be recorded.
    await expect(submit).toBeDisabled();
    await dialog.getByLabel('Alasan pengembalian').fill('Pelanggan membatalkan pesanan');
    await expect(submit).toBeEnabled();

    // No horizontal scroll at either width.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: testInfo.outputPath(`refund-dialog-${name}.png`),
      fullPage: true,
    });

    await submit.click();
    await expect.poll(() => refunds.length).toBe(1);
    expect(refunds[0]).toMatchObject({
      expectedVersion: 4,
      amount: '150000',
      reason: 'Pelanggan membatalkan pesanan',
      refundDisbursement: { method: 'BANK_TRANSFER', paymentRouteId: 'route-bank-b' },
    });
  });
}
