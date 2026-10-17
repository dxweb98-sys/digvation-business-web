import { expect, test, type Page } from '@playwright/test';

/**
 * A queued Sale was partly paid (80,000 of 200,000), then a 50,000 item was added: Runtime now
 * reports a 250,000 total. Paying the balance must collect 170,000, never the first payment again,
 * and the amount shown is the amount sent.
 */
const branchId = '11111111-1111-4111-8111-111111111111';
const saleId = '66666666-6666-4666-8666-666666666666';
const at = '2026-10-17T02:00:00.000Z';

function line(id: string, name: string, total: string) {
  return {
    id,
    saleId,
    catalogItemId: '22222222-2222-4222-8222-222222222222',
    catalogVariantId: null,
    catalogPriceId: '55555555-5555-4555-8555-555555555555',
    itemCodeSnapshot: id.toUpperCase(),
    itemNameSnapshot: name,
    itemTypeSnapshot: 'PRODUCT',
    variantCodeSnapshot: null,
    variantNameSnapshot: null,
    fulfillmentBehaviorSnapshot: 'TRACKED',
    employeeAssignmentModeSnapshot: 'NONE',
    allowEmployeeContributionSnapshot: false,
    defaultDurationMinutesSnapshot: null,
    quantity: '1.0000',
    currency: 'IDR',
    resolvedUnitPrice: total,
    effectiveUnitPrice: total,
    overrideAmount: null,
    overrideReason: null,
    discountType: null,
    discountValue: null,
    discountReason: null,
    grossAmount: total,
    lineDiscountAmount: '0.0000',
    orderDiscountAllocationAmount: '0.0000',
    discountedCustomerBaseAmount: total,
    includedTaxAmount: '0.0000',
    excludedTaxAmount: '0.0000',
    netPreTaxAmount: total,
    taxAmount: '0.0000',
    totalAmount: total,
    removedAt: null,
    createdAt: at,
    updatedAt: at,
    fulfillment: null,
    participations: [],
    contributions: [],
  };
}

function payment(id: string, amount: string) {
  return {
    id,
    saleId,
    method: 'CASH',
    status: 'SUCCEEDED',
    currency: 'IDR',
    appliedAmount: amount,
    tenderedAmount: amount,
    changeAmount: '0.0000',
    providerReference: null,
    kind: 'PAYMENT',
    correction: null,
    refund: null,
    financePaymentRouteId: 'route-cash',
    financeFinancialAccountId: 'account-cash',
    financeFinancialAccountCodeSnapshot: 'KAS',
    financeFinancialAccountNameSnapshot: 'Kas Laci',
    idempotencyKey: `key-${id}`,
    createdByActorId: 'cashier',
    createdByActorKind: 'USER',
    settledByActorId: 'cashier',
    settledByActorKind: 'USER',
    terminalAt: at,
    createdAt: at,
    updatedAt: at,
  };
}

function queuedSale(version: number, paid: string[]) {
  return {
    id: saleId,
    saleNumber: 'TRX-20261017-000010',
    sellingLocationId: branchId,
    currency: 'IDR',
    status: 'OPEN',
    operationalState: 'QUEUED',
    version,
    grossAmount: '250000.0000',
    discountAmount: '0.0000',
    netPreTaxAmount: '250000.0000',
    taxAmount: '0.0000',
    totalAmount: '250000.0000',
    orderDiscountType: null,
    orderDiscountValue: null,
    orderDiscountReason: null,
    orderDiscountAmount: '0.0000',
    finalizedAt: null,
    voidedAt: null,
    createdAt: at,
    updatedAt: at,
    customer: { type: 'NON_MEMBER', name: 'Pelanggan Uji', phone: '+628123450000' },
    lines: [
      line('line-a', 'Perawatan Awal', '200000.0000'),
      line('line-b', 'Produk Tambahan', '50000.0000'),
    ],
    payments: paid.map((amount, index) => payment(`pay-${index + 1}`, amount)),
  };
}

const envelope = (data: unknown) => ({
  success: true,
  data,
  request_id: 'split-e2e',
  timestamp: at,
});

async function mockRuntime(page: Page) {
  await page.addInitScript(() => {
    const prefix = 'digvation.operational.auth-session.v2';
    sessionStorage.setItem(`${prefix}.access-token`, 'e2e-access-token');
    sessionStorage.setItem(`${prefix}.access-expires-at`, '2099-01-01T00:00:00.000Z');
    sessionStorage.setItem(`${prefix}.last-activity`, String(Date.now()));
  });
  const state = {
    sale: queuedSale(4, ['80000.0000']),
    payments: [] as Array<Record<string, unknown>>,
  };
  await page.route('http://127.0.0.1:4003/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const method = request.method();
    let data: unknown = { items: [], limit: 100, offset: 0 };
    if (path === '/session/context')
      data = {
        identity: { userId: 'cashier', displayName: 'Kasir Uji', username: 'kasir', roles: [] },
        business: { tenantId: branchId, name: 'E2E Business', currency: 'IDR' },
        access: {
          products: ['POS'],
          capabilities: [],
          foundations: ['OPERATIONAL_ACCESS', 'ORGANIZATION_LOCATION', 'CATALOG'],
          permissions: [
            'auth:self',
            'sales:create',
            'sales:read',
            'sales:update',
            'payments:create',
            'payments:read',
            'fulfillment:update',
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
        contextVersion: 'split-e2e',
      };
    else if (path === '/operational-access/context')
      data = {
        organizationWide: true,
        resolution: 'AUTO_RESOLVED',
        selectedLocationId: branchId,
        mainLocationId: branchId,
        locations: [{ id: branchId, code: 'MAIN', name: 'Main Branch' }],
      };
    else if (path === '/notifications/unread-count') data = { count: 0 };
    else if (path === '/sales/configuration/tax')
      data = { enabled: false, rate: '0.11', version: 1, createdAt: null, updatedAt: null };
    else if (path === '/operational/catalog') data = { categories: [], items: [] };
    else if (path === '/operational/queue') data = { items: [state.sale], limit: 100, offset: 0 };
    else if (path.endsWith('/payment-routes'))
      data = {
        items: [
          {
            id: 'route-cash',
            sellingLocationId: branchId,
            paymentMethod: 'CASH',
            currency: 'IDR',
            financialAccountId: 'account-cash',
            financialAccountCode: 'KAS',
            financialAccountName: 'Kas Laci',
            status: 'ACTIVE',
            version: 1,
            createdAt: at,
            updatedAt: at,
          },
        ],
        limit: 100,
        offset: 0,
      };
    else if (method === 'GET' && path.endsWith(`/${saleId}`)) data = state.sale;
    else if (method === 'POST' && path.endsWith(`/${saleId}/promotions/refresh`)) data = state.sale;
    else if (method === 'POST' && path.endsWith(`/${saleId}/payments`)) {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.payments.push(body);
      const paid = [
        ...state.sale.payments.map((p) => p.appliedAmount),
        Number(body.appliedAmount).toFixed(4),
      ];
      state.sale = queuedSale(state.sale.version + 1, paid);
      data = state.sale;
    } else if (method !== 'GET') {
      await route.fulfill({
        status: 500,
        json: { success: false, error: { code: 'E2E_UNEXPECTED_WRITE', message: path } },
      });
      return;
    }
    await route.fulfill({ json: envelope(data) });
  });
  return state;
}

async function openBalancePayment(page: Page) {
  await page.goto('/sell');
  await page.getByRole('button', { name: /Antrian transaksi/ }).click();
  await page
    .getByRole('button', { name: /TRX-20261017-000010/ })
    .first()
    .click();
  await page.getByText('Bayar sisa', { exact: true }).click();
  return page.getByRole('dialog', { name: 'Pembayaran' });
}

test('after an item is added to a partly paid Sale, the balance paid is the new remainder', async ({
  page,
}) => {
  const state = await mockRuntime(page);
  const dialog = await openBalancePayment(page);
  await expect(dialog).toBeVisible();
  const pay = dialog.getByRole('button', { name: /^Bayar Rp/ });
  // 250,000 total - 80,000 already paid = 170,000; never the old 120,000 or the 250,000 total.
  await expect(pay).toHaveText(/170\.000/);
  await pay.click();
  await dialog.getByRole('button', { name: 'Konfirmasi dan selesaikan' }).click();
  await expect.poll(() => state.payments.length).toBe(1);
  expect(Number(state.payments[0]!.appliedAmount)).toBe(170000);
  expect(state.payments[0]).toMatchObject({
    method: 'CASH',
    paymentRouteId: 'route-cash',
    expectedVersion: 4,
  });
});

test('a further partial payment, then the exact rest; shown and sent amounts always match', async ({
  page,
}) => {
  const state = await mockRuntime(page);
  const dialog = await openBalancePayment(page);
  await dialog.getByRole('tab', { name: 'Bayar sebagian' }).click();
  await dialog.getByLabel('Nominal pembayaran').fill('100.000');
  const pay = dialog.getByRole('button', { name: /^Bayar Rp/ });
  await expect(pay).toHaveText(/100\.000/);
  await pay.click();
  await dialog.getByRole('button', { name: 'Konfirmasi pembayaran' }).click();
  await expect.poll(() => state.payments.length).toBe(1);
  expect(Number(state.payments[0]!.appliedAmount)).toBe(100000);

  // Runtime recorded it: 70,000 is left and the dialog offers exactly that, in full.
  await expect(dialog.getByRole('tab', { name: 'Bayar penuh' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(pay).toHaveText(/70\.000/);
  await pay.click();
  await dialog.getByRole('button', { name: 'Konfirmasi dan selesaikan' }).click();
  await expect.poll(() => state.payments.length).toBe(2);
  expect(Number(state.payments[1]!.appliedAmount)).toBe(70000);
  const paid = state.sale.payments.reduce((sum, p) => sum + Number(p.appliedAmount), 0);
  expect(paid).toBe(250000);
});
