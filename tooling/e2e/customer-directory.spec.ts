import { expect, test, type Page, type TestInfo } from '@playwright/test';

const locationId = '11111111-1111-4111-8111-111111111111';
const at = '2026-10-03T01:00:00.000Z';
const regular = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Dicky',
  phoneE164: '+628123456789',
  status: 'ACTIVE',
  version: 1,
  createdAt: at,
  updatedAt: at,
};
const relationship = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  memberNumber: 'MBR-0001',
  status: 'ACTIVE',
  joinedAt: at,
};
const memberCustomer = {
  ...regular,
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Rina Member',
  phoneE164: '+628111222333',
};
const member = {
  ...relationship,
  customerId: memberCustomer.id,
  customer: memberCustomer,
  version: 1,
};
const transaction = {
  saleId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  saleNumber: 'SALE-20261003-001',
  currency: 'IDR',
  totalAmount: '125000.0000',
  finalizedAt: at,
  pointsEarned: null,
  pointsRedeemed: null,
};
const envelope = (data: unknown) => ({
  success: true,
  data,
  request_id: 'customer-render',
  timestamp: at,
});

async function fixture(page: Page, surface: 'operational' | 'backoffice') {
  const state = { membership: false, loyalty: false, empty: false, error: false, loading: false };
  await page.addInitScript(() => {
    for (const app of ['operational', 'backoffice']) {
      const key = `digvation.${app}.auth-session.v2`;
      sessionStorage.setItem(`${key}.access-token`, 'local-customer-render');
      sessionStorage.setItem(`${key}.access-expires-at`, '2099-01-01T00:00:00.000Z');
      sessionStorage.setItem(`${key}.last-activity`, String(Date.now()));
    }
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const customers = [
      regular,
      { ...regular, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Dicky Darmawan' },
      { ...regular, id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', phoneE164: '+628999888777' },
      memberCustomer,
    ].map((c) =>
      state.membership ? { ...c, membership: c.id === memberCustomer.id ? relationship : null } : c,
    );
    let data: unknown = { items: [], total: 0, limit: 20, offset: 0 };
    if (path === '/session/context')
      data = {
        identity: {
          userId: 'customer-review',
          displayName: 'Directory Review',
          username: 'review',
          roles: [],
        },
        business: { tenantId: locationId, name: 'Directory Review', currency: 'IDR' },
        access: {
          products: ['POS'],
          capabilities: state.membership
            ? state.loyalty
              ? ['MEMBERSHIP', 'LOYALTY_POINTS']
              : ['MEMBERSHIP']
            : [],
          foundations: [
            'CUSTOMER_IDENTITY',
            'OPERATIONAL_ACCESS',
            'ORGANIZATION_LOCATION',
            'CATALOG',
          ],
          permissions: [
            'auth:self',
            'backoffice:access',
            'customers:read',
            'customers:manage',
            'sales:read',
            'sales:create',
            'catalog:read',
            ...(state.membership
              ? ['membership:read', 'membership:enroll', 'membership:update']
              : []),
            ...(state.loyalty ? ['loyalty:read'] : []),
          ],
        },
        preferences: {
          locale: 'id-ID',
          timezone: 'Asia/Jakarta',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: 'HH:mm',
        },
        deployment: { profile: 'DEDICATED' },
        contextVersion: `${state.membership}:${state.loyalty}`,
      };
    else if (path === '/operational-access/context')
      data = {
        organizationWide: true,
        resolution: 'AUTO_RESOLVED',
        selectedLocationId: locationId,
        mainLocationId: locationId,
        locations: [{ id: locationId, code: 'MAIN', name: 'Main Branch' }],
      };
    else if (path === '/locations')
      data = {
        items: [
          { id: locationId, code: 'MAIN', name: 'Main Branch', status: 'ACTIVE', version: 1 },
        ],
        total: 1,
        limit: 100,
        offset: 0,
      };
    else if (path === '/operational/catalog') data = { categories: [], items: [] };
    else if (path === '/operational/queue')
      data = { items: [], receiptDeliveries: [], limit: 100, offset: 0 };
    else if (path === '/customers') {
      if (state.loading) await new Promise((resolve) => setTimeout(resolve, 1500));
      if (state.error) {
        await route.fulfill({
          status: 503,
          json: {
            success: false,
            error: { code: 'UNAVAILABLE', message: 'Local fixture unavailable' },
          },
        });
        return;
      }
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const type = url.searchParams.get('type');
      const rows = state.empty
        ? []
        : customers.filter(
            (c) =>
              (c.name.toLowerCase().includes(q) || c.phoneE164.includes(q)) &&
              (!type ||
                (type === 'MEMBER' ? c.id === memberCustomer.id : c.id !== memberCustomer.id)),
          );
      data = {
        items: rows,
        total: rows.length,
        limit: Number(url.searchParams.get('limit') ?? 20),
        offset: Number(url.searchParams.get('offset') ?? 0),
      };
    } else if (/^\/customers\/[^/]+\/detail$/.test(path)) {
      const customer = customers.find((c) => c.id === path.split('/')[2])!;
      data = {
        customer,
        ...(state.membership
          ? { membership: customer.id === memberCustomer.id ? relationship : null }
          : {}),
        recentTransactions: [transaction],
        transactionTotal: 12,
      };
    } else if (path.startsWith('/customers/') && route.request().method() === 'PATCH') {
      const input = route.request().postDataJSON();
      data = { ...regular, name: input.name, phoneE164: input.phone, version: 2 };
    } else if (path.startsWith('/operational/members/'))
      data = {
        membership: member,
        loyalty: state.loyalty
          ? {
              pointsBalance: '120.0000',
              recentActivity: [
                {
                  id: 'point-entry',
                  type: 'EARN',
                  pointsDelta: '10.0000',
                  balanceAfter: '120.0000',
                  sourceSaleId: transaction.saleId,
                  reversesLedgerEntryId: null,
                  createdAt: at,
                },
              ],
            }
          : null,
        recentTransactions: [transaction],
        transactionTotal: 12,
      };
    else if (path === '/memberships') data = { items: [member], total: 1, limit: 20, offset: 0 };
    else if (path.startsWith('/memberships/')) data = member;
    else if (path.endsWith('/balance'))
      data = { membershipId: member.id, pointsBalance: '120.0000' };
    await route.fulfill({ json: envelope(data) });
  });
  return {
    state,
    url: surface === 'operational' ? 'http://127.0.0.1:5176' : 'http://127.0.0.1:5174',
  };
}

async function shot(page: Page, info: TestInfo, name: string) {
  await expect(page.getByText(/Menyiapkan (Backoffice|Operational)/)).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const width of [390, 430, 1280]) {
  for (const surface of ['operational', 'backoffice'] as const) {
    test(`${surface} Customer directory at ${width}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      const { state, url } = await fixture(page, surface);
      await page.goto(`${url}/customers`);
      await expect(page.getByRole('heading', { name: 'Pelanggan', exact: true })).toBeVisible();
      await expect(
        page.getByText('Dicky Darmawan', { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByText('Jenis pelanggan', { exact: true }).filter({ visible: true }),
      ).toHaveCount(0);
      await shot(page, info, 'customer-only-list');
      if (surface === 'operational')
        await page.getByText('Dicky', { exact: true }).filter({ visible: true }).first().click();
      else await page.getByText('Dicky', { exact: true }).filter({ visible: true }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(transaction.saleNumber, { exact: true })).toBeVisible();
      await expect(page.getByText(/Saldo Poin|Poin saat ini|Nomor Member/)).toHaveCount(0);
      await shot(page, info, 'regular-detail');
      await page.getByRole('button', { name: /Edit profil|Ubah data/, exact: false }).click();
      const editablePhone = page.getByRole('dialog').getByRole('textbox').nth(1);
      await expect(editablePhone).toHaveValue(/^08\d+$/);
      await expect(editablePhone).not.toHaveValue(/\s|\+/);
      await shot(page, info, 'customer-edit');
      await page.getByRole('button', { name: 'Batal', exact: true }).click();
      await page.goto(`${url}/customers`);
      state.membership = true;
      await page.reload();
      await expect(
        page.getByText('Pelanggan Umum', { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();
      await shot(page, info, 'membership-enabled-list');
      if (surface === 'operational')
        await page
          .getByText('Rina Member', { exact: true })
          .filter({ visible: true })
          .first()
          .click();
      else {
        await page.goto(`${url}/memberships`);
        await expect(
          page.getByText('Rina Member', { exact: true }).filter({ visible: true }).first(),
        ).toBeVisible();
        await shot(page, info, 'membership-management');
        await page
          .getByText('Rina Member', { exact: true })
          .filter({ visible: true })
          .first()
          .click();
      }
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.getByRole('dialog').getByText('MBR-0001', { exact: true }).first(),
      ).toBeVisible();
      await shot(page, info, 'member-detail-without-loyalty');
      if (surface === 'operational') {
        await page.getByRole('button', { name: 'Ubah data', exact: true }).click();
        const memberPhone = page.getByRole('dialog').getByRole('textbox').nth(1);
        await expect(memberPhone).toHaveValue(/^08\d+$/);
        await expect(memberPhone).not.toHaveValue(/\s|\+/);
        await shot(page, info, 'member-edit');
        await page.getByRole('button', { name: 'Batal', exact: true }).click();
        state.loyalty = true;
        await page.goto(`${url}/customers`);
        await page
          .getByText('Rina Member', { exact: true })
          .filter({ visible: true })
          .first()
          .click();
        await expect(page.getByText('Poin saat ini', { exact: true })).toBeVisible();
        await shot(page, info, 'member-detail-with-loyalty');
      }
      state.membership = false;
      state.loyalty = false;
      await page.goto(`${url}/customers`);
      await page.getByRole('textbox', { name: /Cari nama/ }).fill('Nothing matches');
      await expect(
        page
          .getByText(
            surface === 'operational'
              ? 'Pelanggan tidak ditemukan.'
              : 'Tidak ada pelanggan yang sesuai.',
            { exact: true },
          )
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await shot(page, info, 'no-results');
      state.empty = true;
      state.loading = true;
      await page.goto(`${url}/customers`);
      await expect(page.getByRole('heading', { name: 'Pelanggan', exact: true })).toBeVisible();
      await shot(page, info, 'loading');
      await expect(
        page.getByText('Belum ada pelanggan.', { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();
      state.loading = false;
      await shot(page, info, 'empty');
      state.empty = false;
      state.error = true;
      await page.reload();
      await expect(
        page.getByText(
          surface === 'operational'
            ? 'Pelanggan gagal dimuat.'
            : 'Pelanggan tidak dapat dimuat. Coba lagi.',
          { exact: true },
        ),
      ).toBeVisible();
      await shot(page, info, 'error');
    });
  }
  test(`POS canonical suggestions at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const { state, url } = await fixture(page, 'operational');
    await page.goto(`${url}/sell`);
    await page.getByRole('button', { name: 'Keranjang', exact: true }).click();
    await page.getByRole('button', { name: /Pilih pelanggan/i }).click();
    await expect(page.getByRole('tab', { name: /Member Terdaftar/ })).toHaveCount(0);
    const regularPhone = page.getByLabel('Nomor WhatsApp / Telepon', { exact: true });
    await regularPhone.fill('+6281234567890');
    await expect(regularPhone).toHaveValue('081234567890');
    await shot(page, info, 'national-phone-input');
    await regularPhone.fill('');
    await page.getByLabel('Nama Pelanggan', { exact: true }).fill('Dicky');
    await shot(page, info, 'suggestions-loading');
    await expect(
      page.getByRole('option', { name: 'Dicky Darmawan +628123456789', exact: true }),
    ).toBeVisible();
    await shot(page, info, 'same-name-and-phone-suggestions');
    await page.getByRole('option', { name: 'Dicky Darmawan +628123456789', exact: true }).click();
    await page.getByRole('button', { name: 'Gunakan Pelanggan', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Pilih Pelanggan', exact: true })).toHaveCount(0);
    await expect(
      page.getByText('Dicky Darmawan', { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
    state.membership = true;
    await page.reload();
    await page.getByRole('button', { name: 'Keranjang', exact: true }).click();
    await page.getByRole('button', { name: /Pilih pelanggan/i }).click();
    await expect(page.getByRole('tab', { name: /Member Terdaftar/ })).toBeVisible();
    await page.getByLabel('Nama Pelanggan', { exact: true }).fill('No match');
    await expect(page.getByText('Pelanggan tidak ditemukan.', { exact: true })).toBeVisible();
    await shot(page, info, 'no-result-create-new');
    await page.getByLabel('Nomor WhatsApp / Telepon', { exact: true }).fill('+628123456789');
    await expect(page.getByRole('option', { name: /Dicky Darmawan/ })).toBeVisible();
    await shot(page, info, 'membership-enabled-suggestions');
    await page
      .getByRole('button', { name: 'Gunakan sebagai pelanggan baru', exact: true })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: 'Pilih Pelanggan', exact: true })).toHaveCount(0);
  });
}
