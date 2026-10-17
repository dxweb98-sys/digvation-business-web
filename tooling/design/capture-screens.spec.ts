import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { test, type Page } from '@playwright/test';

import { BACKOFFICE_URL, OPERATIONAL_URL } from '../e2e/servers';

const outputDirectory = resolve(process.cwd(), 'docs/design/figma/screens');
const at = '2026-10-03T01:00:00.000Z';
const locationId = '11111111-1111-4111-8111-111111111111';

const permissions = [
  'auth:self',
  'backoffice:access',
  'activity:read',
  'attendance:read',
  'attendance:manage',
  'business-profile:read',
  'business-profile:update',
  'cash:move',
  'cash:read',
  'catalog:create',
  'catalog:read',
  'catalog:update',
  'commission:configure',
  'commission:read',
  'customers:manage',
  'customers:read',
  'employees:create',
  'employees:read',
  'employees:update',
  'expenses:approve',
  'expenses:create',
  'expenses:read',
  'expenses:reject',
  'expenses:update',
  'financial-accounts:create',
  'financial-accounts:read',
  'financial-accounts:update',
  'fulfillment:update',
  'locations:create',
  'locations:read',
  'locations:update',
  'loyalty:configure',
  'loyalty:read',
  'loyalty:redeem',
  'membership:enroll',
  'membership:read',
  'membership:update',
  'operational-access:read',
  'operational-access:update',
  'payment-routing:read',
  'payment-routing:update',
  'payments:correct',
  'payments:read',
  'payments:refund',
  'payments:settle',
  'pricing:cancel',
  'pricing:create',
  'pricing:read',
  'promotions:create',
  'promotions:read',
  'promotions:update',
  'reconciliations:create',
  'reconciliations:read',
  'reconciliations:update',
  'roles:create',
  'roles:permissions',
  'roles:read',
  'roles:update',
  'sales:adjust-progressed',
  'sales:create',
  'sales:read',
  'sales:read-completed',
  'sales:reverse',
  'sales:update',
  'settlements:create',
  'settlements:read',
  'settlements:update',
  'tax:read',
  'users:invite',
  'users:read',
  'users:roles',
  'users:update',
];

const sessionContext = {
  identity: {
    userId: 'design-review',
    displayName: 'Design Review',
    username: 'design',
    roles: [],
  },
  business: { tenantId: locationId, name: 'Digvation Salon', currency: 'IDR' },
  access: {
    products: ['POS'],
    capabilities: [
      'POS_PRODUCT_SALES',
      'POS_SERVICE_SALES',
      'POS_PRODUCT_COMMISSION',
      'MEMBERSHIP',
      'LOYALTY_POINTS',
      'PROMOTIONS',
      'BUSINESS_ANALYTICS',
      'MULTI_BRANCH',
      'WORKFORCE_ATTENDANCE',
      'TAX_FISCAL',
      'FINANCE_OPERATIONS',
    ],
    foundations: [
      'CUSTOMER_IDENTITY',
      'OPERATIONAL_ACCESS',
      'ORGANIZATION_LOCATION',
      'CATALOG',
      'CATALOG_SERVICE_COMPOSITION',
      'IDENTITY_ACCESS',
      'EMPLOYEE_WORKFORCE',
      'AUDIT_ACTIVITY',
      'FINANCE_OPERATIONS',
      'WORKFORCE',
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
  contextVersion: 'design-capture',
};

const location = {
  id: locationId,
  code: 'MAIN',
  name: 'Cabang Utama',
  status: 'ACTIVE',
  version: 1,
};
const fixtures: Record<string, unknown> = {
  '/session/context': sessionContext,
  '/operational-access/context': {
    organizationWide: true,
    resolution: 'AUTO_RESOLVED',
    selectedLocationId: locationId,
    mainLocationId: locationId,
    locations: [{ id: locationId, code: 'MAIN', name: 'Cabang Utama' }],
  },
  '/locations': { items: [location], total: 1, limit: 100, offset: 0 },
  '/operational/catalog': { categories: [], items: [] },
  '/operational/queue': { items: [], receiptDeliveries: [], limit: 100, offset: 0 },
  '/reports/dashboard-summary': {
    date: '2026-10-17',
    currency: 'IDR',
    income: '4250000.0000',
    expenses: '850000.0000',
    netRevenue: '3400000.0000',
    totalTransactions: 38,
    financeAvailable: true,
    transactionCompletion: { total: 40, finalized: 38, voided: 2 },
  },
};

// Every report shares one dataset shape, so the dashboard charts render with sample values.
const sampleReport = {
  summary: { totalTransactions: 38, grossSales: '4250000.0000', netSales: '3400000.0000' },
  analytics: {
    trend: ['11 Okt', '12 Okt', '13 Okt', '14 Okt', '15 Okt', '16 Okt', '17 Okt'].map(
      (label, index) => ({
        label,
        value: `${(2 + index * 0.4).toFixed(1)}00000.0000`,
        count: 20 + index * 3,
      }),
    ),
    breakdown: [
      { label: 'Tunai', value: '1800000.0000', count: 16 },
      { label: 'QRIS', value: '1650000.0000', count: 15 },
      { label: 'Kartu', value: '800000.0000', count: 7 },
    ],
    ranking: [
      { label: 'Potong Rambut', value: '1200000.0000', count: 24 },
      { label: 'Creambath', value: '900000.0000', count: 9 },
      { label: 'Hair Coloring', value: '750000.0000', count: 3 },
    ],
  },
  items: [],
  total: 0,
};

const unhandled = new Set<string>();

async function mockBackend(page: Page) {
  await page.addInitScript(() => {
    for (const app of ['operational', 'backoffice']) {
      const key = `digvation.${app}.auth-session.v2`;
      sessionStorage.setItem(`${key}.access-token`, 'design-capture');
      sessionStorage.setItem(`${key}.access-expires-at`, '2099-01-01T00:00:00.000Z');
      sessionStorage.setItem(`${key}.last-activity`, String(Date.now()));
    }
  });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (!(path in fixtures) && !path.startsWith('/reports/'))
      unhandled.add(`${route.request().method()} ${path}`);
    const data =
      fixtures[path] ??
      (path.startsWith('/reports/') ? sampleReport : { items: [], total: 0, limit: 20, offset: 0 });
    await route.fulfill({
      json: { success: true, data, request_id: 'design-capture', timestamp: at },
    });
  });
}

const screens = [
  { name: 'backoffice-login', url: `${BACKOFFICE_URL}/login`, authenticated: false },
  { name: 'backoffice-dashboard', url: `${BACKOFFICE_URL}/` },
  { name: 'backoffice-catalog', url: `${BACKOFFICE_URL}/catalog` },
  { name: 'backoffice-promotions', url: `${BACKOFFICE_URL}/promotions` },
  { name: 'backoffice-employees', url: `${BACKOFFICE_URL}/employees` },
  { name: 'backoffice-memberships', url: `${BACKOFFICE_URL}/memberships` },
  { name: 'backoffice-customers', url: `${BACKOFFICE_URL}/customers` },
  { name: 'backoffice-financial-accounts', url: `${BACKOFFICE_URL}/financial-accounts` },
  { name: 'backoffice-expenses', url: `${BACKOFFICE_URL}/expenses` },
  { name: 'backoffice-reports', url: `${BACKOFFICE_URL}/reports` },
  { name: 'backoffice-transactions', url: `${BACKOFFICE_URL}/transactions` },
  { name: 'backoffice-business-settings', url: `${BACKOFFICE_URL}/business` },
  { name: 'backoffice-activity', url: `${BACKOFFICE_URL}/activity` },
  { name: 'backoffice-access-control', url: `${BACKOFFICE_URL}/access-control` },
  { name: 'backoffice-notifications', url: `${BACKOFFICE_URL}/notifications` },
  { name: 'operational-login', url: `${OPERATIONAL_URL}/`, authenticated: false },
  { name: 'operational-sell', url: `${OPERATIONAL_URL}/sell` },
  { name: 'operational-expenses', url: `${OPERATIONAL_URL}/expenses` },
  { name: 'operational-customers', url: `${OPERATIONAL_URL}/customers` },
];

// Same frame sizes as the Figma templates (docs/design/figma/design-system-library.md).
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1194 },
  // Operational runs on counter tablets, which are usually landscape.
  { name: 'tablet-landscape', width: 1194, height: 834, only: 'operational' },
  { name: 'desktop', width: 1440, height: 900 },
];

test.beforeAll(() => mkdirSync(outputDirectory, { recursive: true }));

test.afterAll(() => {
  if (unhandled.size > 0) {
    console.log(`Endpoints answered with an empty list:\n${[...unhandled].sort().join('\n')}`);
  }
});

for (const screen of screens) {
  for (const { only, ...viewport } of viewports) {
    if (only && !screen.name.startsWith(only)) continue;
    test(`${screen.name} (${viewport.name})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      if (screen.authenticated !== false) await mockBackend(page);
      await page.goto(screen.url);
      await page.waitForLoadState('networkidle');
      // Let the startup splash and entrance animations settle.
      await page.waitForTimeout(800);
      await page.screenshot({
        path: resolve(outputDirectory, `${screen.name}--${viewport.name}.png`),
      });
    });
  }
}
