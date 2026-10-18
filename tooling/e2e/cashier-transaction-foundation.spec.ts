import { expect, test, type Page, type Route } from '@playwright/test';

const branch = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'MAIN',
  name: 'Main Branch',
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

const category = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  code: 'SERVICE',
  name: 'Services',
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

const catalogItem = {
  id: '22222222-2222-4222-8222-222222222222',
  code: 'HAIRCUT',
  name: 'Hair Cut',
  type: 'SERVICE',
  categoryId: category.id,
  description: null,
  lifecycle: 'ACTIVE',
  fulfillmentBehavior: 'INSTANT',
  variantSelectionMode: 'REQUIRED',
  productUsage: 'STANDALONE_AND_COMPONENT',
  requireAdditionalItemAtSale: false,
  version: 1,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  serviceDefinition: {
    defaultDurationMinutes: null,
    employeeAssignmentMode: 'REQUIRED',
    allowEmployeeContribution: true,
  },
};

const saleId = '33333333-3333-4333-8333-333333333333';
const lineId = '44444444-4444-4444-8444-444444444444';

function createEmptySale() {
  return {
    id: saleId,
    sellingLocationId: branch.id,
    currency: 'IDR',
    status: 'OPEN',
    operationalState: 'UNSUBMITTED',
    version: 1,
    grossAmount: '0.0000',
    discountAmount: '0.0000',
    netPreTaxAmount: '0.0000',
    taxAmount: '0.0000',
    totalAmount: '0.0000',
    orderDiscountType: null,
    orderDiscountValue: null,
    orderDiscountReason: null,
    orderDiscountAmount: '0.0000',
    finalizedAt: null,
    voidedAt: null,
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    lines: [],
    payments: [],
  };
}

function createLine(quantity = '1.0000', total = '125000.0000') {
  return {
    id: lineId,
    saleId,
    catalogItemId: catalogItem.id,
    catalogVariantId: null,
    catalogPriceId: '55555555-5555-4555-8555-555555555555',
    itemCodeSnapshot: catalogItem.code,
    itemNameSnapshot: catalogItem.name,
    itemTypeSnapshot: catalogItem.type,
    variantCodeSnapshot: null,
    variantNameSnapshot: null,
    fulfillmentBehaviorSnapshot: 'INSTANT',
    employeeAssignmentModeSnapshot: 'NONE',
    allowEmployeeContributionSnapshot: false,
    defaultDurationMinutesSnapshot: null,
    quantity,
    currency: 'IDR',
    resolvedUnitPrice: '125000.0000',
    effectiveUnitPrice: '125000.0000',
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
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    fulfillment: null,
    participations: [],
    contributions: [],
  };
}

function createSaleWithLine(version = 2, quantity = '1.0000', total = '125000.0000') {
  return {
    ...createEmptySale(),
    version,
    grossAmount: total,
    netPreTaxAmount: total,
    totalAmount: total,
    updatedAt: `2026-09-02T00:0${Math.min(version, 9)}:00.000Z`,
    lines: [createLine(quantity, total)],
  };
}

function resolvedPrice() {
  return {
    catalogPriceId: '55555555-5555-4555-8555-555555555555',
    catalogItemId: catalogItem.id,
    catalogVariantId: null,
    locationId: branch.id,
    currency: 'IDR',
    amount: '125000.0000',
    effectiveAt: '2026-09-02T00:00:00.000Z',
    sourceScope: { catalogVariantId: null, locationId: branch.id },
  };
}

function envelope<T>(data: T) {
  return {
    success: true,
    data,
    request_id: 'cashier-e2e',
    timestamp: '2026-09-02T00:00:00.000Z',
  };
}

function failure(code: string, message: string) {
  return {
    success: false,
    error: { code, message },
    request_id: 'cashier-e2e',
    timestamp: '2026-09-02T00:00:00.000Z',
  };
}

interface RouteState {
  currentSale: ReturnType<typeof createEmptySale> | ReturnType<typeof createSaleWithLine>;
  /** Sale-creating requests: the cart stays local until checkout, so these must stay at zero. */
  createRequests: number;
  salesListRequests: number;
  previewQuantities: string[];
  failPreview: boolean;
}

async function installRoutes(page: Page, options: Partial<RouteState> = {}) {
  await page.addInitScript(() => {
    const prefix = 'digvation.operational.auth-session.v2';
    window.sessionStorage.setItem(`${prefix}.access-token`, 'e2e-access-token');
    window.sessionStorage.setItem(`${prefix}.access-expires-at`, '2099-01-01T00:00:00.000Z');
    window.sessionStorage.setItem(`${prefix}.last-activity`, String(Date.now()));
  });

  const state: RouteState = {
    currentSale: createEmptySale(),
    createRequests: 0,
    salesListRequests: 0,
    previewQuantities: [],
    failPreview: false,
    ...options,
  };

  const fulfillUnhandled = async (route: Route, method: string, pathname: string) => {
    await route.fulfill({ status: 404, json: failure('E2E_UNHANDLED', `${method} ${pathname}`) });
  };

  await page.route('http://127.0.0.1:4003/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    // Canonical browser-session hydration (replaces the legacy auth/me + runtime/context pair).
    if (method === 'GET' && url.pathname === '/api/v1/session/context') {
      await route.fulfill({
        json: envelope({
          identity: {
            userId: 'e2e-operational-user',
            displayName: 'E2E Operational User',
            username: 'e2e.operational',
            roles: [],
          },
          business: { tenantId: branch.id, name: 'E2E Business', currency: 'IDR' },
          access: {
            products: ['POS'],
            capabilities: [],
            foundations: ['OPERATIONAL_ACCESS', 'ORGANIZATION_LOCATION', 'CATALOG'],
            permissions: ['auth:self', 'sales:create', 'sales:read', 'catalog:read'],
          },
          preferences: {
            locale: 'id-ID',
            timezone: 'Asia/Jakarta',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: 'HH:mm',
          },
          deployment: { profile: 'DEDICATED' },
          contextVersion: 'cashier-e2e-context',
        }),
      });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/operational-access/context') {
      await route.fulfill({
        json: envelope({
          organizationWide: true,
          resolution: 'AUTO_RESOLVED',
          selectedLocationId: branch.id,
          mainLocationId: branch.id,
          locations: [{ id: branch.id, code: branch.code, name: branch.name }],
        }),
      });
      return;
    }
    if (method === 'POST' && url.pathname === '/api/v1/operational/transactions/pricing-preview') {
      const body = request.postDataJSON() as { lines: Array<{ quantity: string }> };
      state.previewQuantities.push(body.lines[0]?.quantity ?? '');
      if (state.failPreview) {
        await route.fulfill({
          status: 409,
          json: failure('CATALOG_PRICE_NOT_FOUND', 'No effective price for this selection'),
        });
        return;
      }
      const quantity = Number(body.lines[0]?.quantity ?? '0');
      const total = (quantity * 125000).toFixed(4);
      await route.fulfill({
        json: envelope({
          currency: 'IDR',
          grossAmount: total,
          promotions: [],
          discountAmount: '0.0000',
          netPreTaxAmount: total,
          taxRate: null,
          taxPriceTreatment: null,
          taxAmount: '0.0000',
          totalAmount: total,
        }),
      });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/notifications/unread-count') {
      await route.fulfill({ json: envelope({ count: 0 }) });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/sales/configuration/tax') {
      await route.fulfill({
        json: envelope({
          enabled: false,
          rate: '0.11',
          version: 1,
          createdAt: null,
          updatedAt: null,
        }),
      });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/operational/catalog') {
      await route.fulfill({
        json: envelope({
          categories: [category],
          items: [
            {
              ...catalogItem,
              displayPrice: { amount: '125000.0000', currency: 'IDR', kind: 'EXACT' },
              resolvedPrice: resolvedPrice(),
              variants: [],
            },
          ],
        }),
      });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/operational/employees') {
      await route.fulfill({ json: envelope({ items: [], limit: 100, offset: 0 }) });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/operational/payment-routes') {
      await route.fulfill({ json: envelope({ items: [], limit: 0, offset: 0 }) });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/operational/queue') {
      state.salesListRequests += 1;
      await route.fulfill({
        json: envelope({ items: [state.currentSale], limit: 100, offset: 0 }),
      });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/locations') {
      await route.fulfill({ json: envelope({ items: [branch], limit: 100, offset: 0 }) });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/employees') {
      await route.fulfill({ json: envelope({ items: [], limit: 100, offset: 0 }) });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/catalog/categories') {
      await route.fulfill({ json: envelope({ items: [category], limit: 100, offset: 0 }) });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/catalog/items') {
      await route.fulfill({ json: envelope({ items: [catalogItem], limit: 100, offset: 0 }) });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/pricing/resolve') {
      expect(url.searchParams.get('catalogItemId')).toBe(catalogItem.id);
      expect(url.searchParams.get('locationId')).toBe(branch.id);
      expect(url.searchParams.get('currency')).toBe('IDR');
      expect(url.searchParams.get('effectiveAt')).toBeTruthy();
      await route.fulfill({
        json: envelope({
          catalogPriceId: '55555555-5555-4555-8555-555555555555',
          catalogItemId: catalogItem.id,
          catalogVariantId: null,
          locationId: branch.id,
          currency: 'IDR',
          amount: '125000.0000',
          effectiveAt: url.searchParams.get('effectiveAt'),
          sourceScope: { catalogVariantId: null, locationId: branch.id },
        }),
      });
      return;
    }
    if (method === 'GET' && url.pathname === `/api/v1/catalog/items/${catalogItem.id}/variants`) {
      await route.fulfill({ json: envelope({ items: [], limit: 100, offset: 0 }) });
      return;
    }
    if (
      method === 'POST' &&
      ['/api/v1/operational/transactions', '/api/v1/operational/transactions/empty'].includes(
        url.pathname,
      )
    ) {
      state.createRequests += 1;
      await route.fulfill({ status: 500, json: failure('E2E_UNEXPECTED_CREATE', url.pathname) });
      return;
    }

    await fulfillUnhandled(route, method, url.pathname);
  });

  return state;
}

async function addFirstItemToCart(page: Page) {
  await page.goto('/sell');
  await expect(page.getByRole('button', { name: /Cabang aktif Main Branch/i })).toBeVisible();
  await expect(page.getByText(/Rp\s?125\.000/)).toBeVisible();
  await page.getByRole('button', { name: 'Tambah Hair Cut', exact: true }).click();
  await page.getByRole('button', { name: 'Tambahkan ke keranjang' }).click();
}

const cartDialog = (page: Page) => page.locator('[role="dialog"][aria-label="Keranjang"]').first();

test('idle Sell does not poll the Sales list continuously', async ({ page }) => {
  const state = await installRoutes(page);

  await page.goto('/sell');
  await expect(page.getByRole('button', { name: /Cabang aktif Main Branch/i })).toBeVisible();
  await expect.poll(() => state.salesListRequests).toBeGreaterThan(0);
  const baseline = state.salesListRequests;

  await page.waitForTimeout(2_200);

  expect(state.salesListRequests).toBe(baseline);
});

test('Operational keeps a fixed left sidebar below the lg breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await installRoutes(page);

  await page.goto('/sell');
  await expect(page.getByRole('button', { name: /Cabang aktif Main Branch/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tambah Hair Cut', exact: true })).toBeVisible();

  const sidebarBox = await page.locator('aside').boundingBox();
  const contentBox = await page.locator('main').first().boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  // operational-shell.tsx: `md:w-[232px] lg:w-[280px]`; 900px sits in the md range.
  expect(sidebarBox!.width).toBe(232);
  expect(contentBox!.x).toBeGreaterThanOrEqual(sidebarBox!.width);
});

test('adding the first item keeps the cart local and creates no Sale', async ({ page }) => {
  const state = await installRoutes(page);

  await page.goto('/sell');
  await expect(cartDialog(page).getByText('Keranjang kosong')).toBeVisible();
  await expect(page.getByRole('button', { name: /Cabang aktif Main Branch/i })).toBeVisible();

  await page.getByRole('button', { name: 'Tambah Hair Cut', exact: true }).click();
  await page.getByRole('button', { name: 'Tambahkan ke keranjang' }).click();

  await expect(page).toHaveURL(/\/sell$/);
  await page.getByRole('button', { name: 'Keranjang', exact: true }).click();
  await expect(cartDialog(page).getByText('Hair Cut', { exact: true })).toBeVisible();
  await expect(cartDialog(page).getByText('Estimasi total')).toBeVisible();
  expect(state.createRequests).toBe(0);
  expect(state.previewQuantities).toEqual(['1.0000']);
});

test('a failed pricing preview keeps the cart item and still creates no Sale', async ({ page }) => {
  const state = await installRoutes(page, { failPreview: true });

  await addFirstItemToCart(page);
  await page.getByRole('button', { name: 'Keranjang', exact: true }).click();

  await expect(cartDialog(page).getByText('Hair Cut', { exact: true })).toBeVisible();
  expect(state.createRequests).toBe(0);
  expect(state.previewQuantities.length).toBeGreaterThan(0);
});

test('quantity and remove change only the local cart and re-price it through the preview', async ({
  page,
}) => {
  const state = await installRoutes(page);
  await addFirstItemToCart(page);

  await page.getByRole('button', { name: 'Keranjang', exact: true }).click();
  const cart = cartDialog(page);
  await cart.getByRole('button', { name: 'Tambah jumlah Hair Cut' }).click();
  await expect(cart.getByRole('status', { name: 'Jumlah Hair Cut' })).toHaveText('2');
  await expect.poll(() => state.previewQuantities.at(-1)).toBe('2.0000');

  await cart.getByRole('button', { name: 'Hapus Hair Cut' }).click();
  await expect(cart.getByText('Keranjang kosong')).toBeVisible();
  expect(state.createRequests).toBe(0);
});

test('queued transactions render without creating or adding a Sale', async ({ page }) => {
  const state = await installRoutes(page, {
    currentSale: { ...createSaleWithLine(), operationalState: 'QUEUED' },
  });

  await page.goto('/sell');
  await expect(page.getByRole('button', { name: /Cabang aktif Main Branch/i })).toBeVisible();
  await expect(page.getByText('Antrian transaksi', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Antrian transaksi/ }).click();
  await expect(page.getByText(`Transaksi ${saleId.slice(0, 8)}`)).toBeVisible();

  expect(state.createRequests).toBe(0);
});
