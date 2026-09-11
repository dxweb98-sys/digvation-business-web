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
  taxCategoryId: null,
  description: null,
  lifecycle: 'ACTIVE',
  fulfillmentBehavior: 'INSTANT',
  version: 1,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  serviceDefinition: {
    defaultDurationMinutes: null,
    employeeAssignmentMode: 'NONE',
    allowEmployeeContribution: false,
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
  createRequests: number;
  addRequests: number;
  salesListRequests: number;
  quantityExpectedVersions: number[];
  removeExpectedVersions: number[];
  conflictOnNextQuantity: boolean;
  failFirstAdd: boolean;
}

async function installRoutes(page: Page, options: Partial<RouteState> = {}) {
  const state: RouteState = {
    currentSale: createEmptySale(),
    createRequests: 0,
    addRequests: 0,
    salesListRequests: 0,
    quantityExpectedVersions: [],
    removeExpectedVersions: [],
    conflictOnNextQuantity: false,
    failFirstAdd: false,
    ...options,
  };

  const fulfillUnhandled = async (route: Route, method: string, pathname: string) => {
    await route.fulfill({ status: 404, json: failure('E2E_UNHANDLED', `${method} ${pathname}`) });
  };

  await page.route('http://127.0.0.1:4003/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

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
    if (method === 'POST' && url.pathname === '/api/v1/sales') {
      state.createRequests += 1;
      expect(request.headers()['idempotency-key']).toBeTruthy();
      expect(request.postDataJSON()).toEqual({ sellingLocationId: branch.id, currency: 'IDR' });
      state.currentSale = createEmptySale();
      await route.fulfill({ status: 201, json: envelope(state.currentSale) });
      return;
    }
    if (method === 'GET' && url.pathname === `/api/v1/sales/${saleId}`) {
      await route.fulfill({ json: envelope(state.currentSale) });
      return;
    }
    if (method === 'GET' && url.pathname === '/api/v1/sales') {
      state.salesListRequests += 1;
      await route.fulfill({
        json: envelope({ items: [state.currentSale], limit: 100, offset: 0 }),
      });
      return;
    }
    if (method === 'POST' && url.pathname === `/api/v1/sales/${saleId}/lines`) {
      state.addRequests += 1;
      expect(request.headers()['idempotency-key']).toBeTruthy();
      expect(request.postDataJSON()).toEqual({
        expectedVersion: 1,
        catalogItemId: catalogItem.id,
        quantity: '1',
      });
      if (state.failFirstAdd && state.addRequests === 1) {
        await route.fulfill({
          status: 409,
          json: failure('CATALOG_PRICE_NOT_FOUND', 'No effective price for this selection'),
        });
        return;
      }
      state.currentSale = createSaleWithLine();
      await route.fulfill({ status: 201, json: envelope(state.currentSale) });
      return;
    }
    if (method === 'POST' && url.pathname === `/api/v1/sales/${saleId}/lines/${lineId}/quantity`) {
      const body = request.postDataJSON() as { expectedVersion: number; quantity: string };
      state.quantityExpectedVersions.push(body.expectedVersion);
      if (state.conflictOnNextQuantity) {
        state.conflictOnNextQuantity = false;
        state.currentSale = createSaleWithLine(3);
        await route.fulfill({
          status: 409,
          json: failure('SALE_VERSION_CONFLICT', 'Sale changed; reload before retrying'),
        });
        return;
      }
      state.currentSale = createSaleWithLine(3, '2.0000', '250000.0000');
      await route.fulfill({ json: envelope(state.currentSale) });
      return;
    }
    if (method === 'POST' && url.pathname === `/api/v1/sales/${saleId}/lines/${lineId}/remove`) {
      const body = request.postDataJSON() as { expectedVersion: number };
      state.removeExpectedVersions.push(body.expectedVersion);
      const removedLine = {
        ...createLine('2.0000', '250000.0000'),
        removedAt: '2026-09-02T00:05:00.000Z',
      };
      state.currentSale = {
        ...createEmptySale(),
        version: 4,
        updatedAt: '2026-09-02T00:05:00.000Z',
        lines: [removedLine],
      } as ReturnType<typeof createSaleWithLine>;
      await route.fulfill({ json: envelope(state.currentSale) });
      return;
    }

    await fulfillUnhandled(route, method, url.pathname);
  });

  return state;
}

async function startSaleFromFirstItem(page: Page) {
  await page.goto('/sell');
  await expect(page.getByRole('button', { name: /Active branch Main Branch/i })).toBeVisible();
  await expect(page.getByText(/Rp\s?125\.000/)).toBeVisible();
  await page.getByRole('button', { name: 'Add Hair Cut', exact: true }).click();
}

test('idle Sell does not poll the Sales list continuously', async ({ page }) => {
  const state = await installRoutes(page);

  await page.goto('/sell');
  await expect(page.getByRole('button', { name: /Active branch Main Branch/i })).toBeVisible();
  await expect.poll(() => state.salesListRequests).toBeGreaterThan(0);
  const baseline = state.salesListRequests;

  await page.waitForTimeout(2_200);

  expect(state.salesListRequests).toBe(baseline);
});

test('Operational keeps a fixed left sidebar below the old lg breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await installRoutes(page);

  await page.goto('/sell');
  await expect(page.getByRole('button', { name: /Active branch Main Branch/i })).toBeVisible();
  await expect(page.getByText('Point of Sale', { exact: true })).toBeVisible();

  const sidebarBox = await page.locator('aside').boundingBox();
  const contentBox = await page.locator('main').first().boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(sidebarBox!.width).toBeGreaterThanOrEqual(250);
  expect(sidebarBox!.width).toBeLessThanOrEqual(260);
  expect(contentBox!.x).toBeGreaterThanOrEqual(sidebarBox!.width);
});

test('lazy start creates the Sale only when the first item is added', async ({ page }) => {
  const state = await installRoutes(page);

  await page.goto('/sell');
  await expect(
    page.locator('[role="dialog"][aria-label="Cart"]').first().getByText('Cart masih kosong'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Sale' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Active branch Main Branch/i })).toBeVisible();

  await page.getByRole('button', { name: 'Add Hair Cut', exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/sell/${saleId}$`));
  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  await expect(
    page
      .locator('[role="dialog"][aria-label="Cart"]')
      .first()
      .getByText('Hair Cut', { exact: true }),
  ).toBeVisible();
  expect(state.createRequests).toBe(1);
  expect(state.addRequests).toBe(1);
});

test('first-line failure preserves the created empty OPEN Sale', async ({ page }) => {
  const state = await installRoutes(page, { failFirstAdd: true });

  await startSaleFromFirstItem(page);

  await expect(page).toHaveURL(new RegExp(`/sell/${saleId}$`));
  await expect(page.getByRole('alert')).toContainText('No effective price for this selection');
  await expect(page.getByText('No effective price for this selection')).toBeVisible();
  expect(state.createRequests).toBe(1);
  expect(state.addRequests).toBe(1);
});

test('quantity and remove use the latest authoritative Sale version', async ({ page }) => {
  const state = await installRoutes(page);
  await startSaleFromFirstItem(page);

  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  const cart = page.locator('[role="dialog"][aria-label="Cart"]').first();
  await cart.getByRole('button', { name: 'Increase Hair Cut quantity' }).click();
  await expect(cart.getByLabel('Quantity for Hair Cut')).toHaveValue('2');
  expect(state.quantityExpectedVersions).toEqual([2]);

  await cart.getByRole('button', { name: 'Remove Hair Cut' }).click();
  await expect(cart.getByText('Cart masih kosong')).toBeVisible();
  expect(state.removeExpectedVersions).toEqual([3]);
});

test('version conflict reloads latest Sale and never auto-replays the command', async ({
  page,
}) => {
  const state = await installRoutes(page, { conflictOnNextQuantity: true });
  await startSaleFromFirstItem(page);

  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  await page
    .locator('[role="dialog"][aria-label="Cart"]')
    .first()
    .getByRole('button', { name: 'Increase Hair Cut quantity' })
    .click();

  await expect(page.getByText(/changed on another terminal/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reviewed' })).toBeVisible();
  expect(state.quantityExpectedVersions).toEqual([2]);

  await page.waitForTimeout(250);
  expect(state.quantityExpectedVersions).toEqual([2]);
  await page.getByRole('button', { name: 'Close active cart' }).click();
  await page.getByRole('button', { name: 'Reviewed' }).click();
  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  await expect(
    page
      .locator('[role="dialog"][aria-label="Cart"]')
      .first()
      .getByRole('button', { name: 'Increase Hair Cut quantity' }),
  ).toBeEnabled();
});

test('Open Sales switches active Sale by navigation only', async ({ page }) => {
  const state = await installRoutes(page, { currentSale: createSaleWithLine() });

  await page.goto('/open-sales');
  await expect(page.getByRole('heading', { name: 'Open Sales' })).toBeVisible();
  await expect(page.getByText(`Sale ${saleId.slice(0, 8)}`)).toBeVisible();

  await page.getByText(`Sale ${saleId.slice(0, 8)}`).click();
  await expect(page).toHaveURL(new RegExp(`/sell/${saleId}$`));
  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  await expect(
    page
      .locator('[role="dialog"][aria-label="Cart"]')
      .first()
      .getByText('Hair Cut', { exact: true }),
  ).toBeVisible();

  expect(state.createRequests).toBe(0);
  expect(state.addRequests).toBe(0);
});
