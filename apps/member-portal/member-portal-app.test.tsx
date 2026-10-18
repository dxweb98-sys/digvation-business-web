/* eslint-disable @typescript-eslint/naming-convention -- request paths are route keys */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import type { MemberPortalApp } from './member-portal-app';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'BUSINESS_ISOLATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'salon-kita' },
  applications: { operational: true, backoffice: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
};

const summary = {
  businessName: 'Salon Kita',
  memberName: 'Rina',
  memberNumber: 'M-0001',
  status: 'ACTIVE',
  pointsBalance: '1250.0000',
};
const pointRows = Array.from({ length: 20 }, (_, index) => ({
  id: `p${index}`,
  type: 'EARN',
  pointsDelta: '10.0000',
  balanceAfter: '10.0000',
  reference: `INV-${index}`,
  createdAt: '2026-09-01T03:00:00.000Z',
}));
const transactions = [
  {
    reference: 'INV-9',
    status: 'SELESAI',
    occurredAt: '2026-09-02T03:00:00.000Z',
    total: '150000.0000',
    currency: 'IDR',
    earnedPoints: '15.0000',
    redeemedPoints: '0.0000',
    lines: [{ name: 'Potong rambut', quantity: '1.0000', total: '150000.0000' }],
  },
];

type Handler = (init: RequestInit | undefined, url: string) => Response | Promise<Response>;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function mockApi(overrides: Record<string, Handler> = {}, options: { signedIn?: boolean } = {}) {
  let signedIn = options.signedIn ?? false;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const routes: Record<string, Handler> = {
    '/runtime-config.json': () => new Response(JSON.stringify(bootstrap)),
    '/api/v1/member-portal/auth/request-otp': () =>
      json({ accepted: true, challengeId: 'c1', resendAfterSeconds: 60 }, 202),
    '/api/v1/member-portal/auth/verify-otp': () => {
      signedIn = true;
      return json({ authenticated: true });
    },
    '/api/v1/member-portal/auth/logout': () => {
      signedIn = false;
      return json({ completed: true });
    },
    '/api/v1/member-portal/summary': () =>
      signedIn ? json(summary) : json({ code: 'MEMBER_PORTAL_SESSION_INVALID' }, 401),
    '/api/v1/member-portal/points': () => json({ items: pointRows.slice(0, 2) }),
    '/api/v1/member-portal/transactions': () => json({ items: transactions }),
    ...overrides,
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes[url.split('?')[0]!];
    if (!route) throw new Error(`Unexpected request ${url}`);
    return route(init, url);
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

const bodyOf = (call: { init?: RequestInit }) => JSON.parse(String(call.init?.body));
const phoneInput = () => screen.getByLabelText(/Nomor WhatsApp/i) as HTMLInputElement;

async function requestCode(phone = '08192381923') {
  await screen.findByRole('button', { name: 'Kirim kode OTP' });
  await screen.findByRole('button', { name: 'Kirim kode OTP' });
  fireEvent.change(phoneInput(), { target: { value: phone } });
  fireEvent.click(screen.getByRole('button', { name: 'Kirim kode OTP' }));
  await screen.findByLabelText('Kode OTP');
}
const memberHeading = () => screen.findByRole('heading', { name: 'Rina' });
const portalNav = () => within(screen.getByRole('navigation', { name: 'Navigasi portal' }));
const openView = (name: string) => fireEvent.click(portalNav().getByRole('button', { name }));

async function login(phone?: string) {
  await requestCode(phone);
  fireEvent.change(screen.getByLabelText('Kode OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verifikasi' }));
  await memberHeading();
}

let portalApp: typeof MemberPortalApp;
const renderPortal = () => render(createElement(portalApp));
beforeEach(async () => {
  vi.stubGlobal('scrollTo', vi.fn());
  // The deployment bootstrap is cached per page load; each test starts a fresh page.
  vi.resetModules();
  ({ MemberPortalApp: portalApp } = await import('./member-portal-app'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('phone + OTP entry', () => {
  it('opens the phone screen when there is no valid session, without resolving any handle', async () => {
    const calls = mockApi();
    renderPortal();
    expect(await screen.findByRole('heading', { name: 'Selamat datang' })).toBeInTheDocument();
    expect(phoneInput()).toBeInTheDocument();
    expect(calls.map((call) => call.url).every((url) => !/entry|handle/.test(url))).toBe(true);
    expect(calls.some((call) => call.url.endsWith('/auth/request-otp'))).toBe(false);
    expect(screen.queryByText(/Rina|Member M-|poin saya/i)).not.toBeInTheDocument();
  });

  it('shows the fixed +62 prefix beside the field', async () => {
    mockApi();
    renderPortal();
    await screen.findByRole('button', { name: 'Kirim kode OTP' });
    expect(screen.getByText('+62')).toBeInTheDocument();
  });

  it('sends canonical +62 with the deployment workspace and no member identifiers', async () => {
    const calls = mockApi();
    renderPortal();
    await requestCode('8192381923');
    const request = calls.find((call) => call.url.endsWith('/auth/request-otp'))!;
    expect(bodyOf(request)).toEqual({ workspace: 'salon-kita', phone: '+628192381923' });
    expect(calls.some((call) => /entry|handle/.test(call.url))).toBe(false);
    expect(JSON.stringify(bodyOf(request))).not.toMatch(/tenant|customer|membership|handle/i);
  });

  it.each([
    ['manual 8… input', '8192381923'],
    ['pasted 08…', '08192381923'],
    ['pasted 62…', '628192381923'],
    ['pasted +62…', '+628192381923'],
    ['pasted +62 with separators', '+62 819-2381-923'],
  ])(
    '%s shows the national number without a leading 0 and submits canonical +62',
    async (_label, typed) => {
      const calls = mockApi();
      renderPortal();
      await screen.findByRole('button', { name: 'Kirim kode OTP' });
      fireEvent.change(phoneInput(), { target: { value: typed } });
      expect(phoneInput().value).toBe('8192381923');
      expect(phoneInput().value).not.toMatch(/^0|^62/);
      fireEvent.click(screen.getByRole('button', { name: 'Kirim kode OTP' }));
      await screen.findByLabelText('Kode OTP');
      const request = calls.find((call) => call.url.endsWith('/auth/request-otp'))!;
      expect(bodyOf(request).phone).toBe('+628192381923');
      // The OTP step does not repeat the number; going back keeps the same national value.
      expect(screen.queryByLabelText(/Nomor WhatsApp/i)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Ubah nomor' }));
      await screen.findByLabelText(/Nomor WhatsApp/i);
      expect(phoneInput().value).toBe('8192381923');
    },
  );

  it('opens the OTP UI on a generic accepted response without exposing member data or the phone', async () => {
    mockApi();
    renderPortal();
    await requestCode();
    expect(
      screen.getByText('Kode telah dikirim melalui WhatsApp ke nomor yang terdaftar.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\+628192381923/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rina|M-0001|1\.250/)).not.toBeInTheDocument();
  });

  it('shows the generic enumeration-safe note before any request', async () => {
    mockApi();
    renderPortal();
    await screen.findByRole('button', { name: 'Kirim kode OTP' });
    expect(
      screen.getByText(
        'Jika nomor terdaftar sebagai member, kode OTP akan dikirim melalui WhatsApp.',
      ),
    ).toBeInTheDocument();
  });

  it('accepts only digits, max six, in the OTP field', async () => {
    mockApi();
    renderPortal();
    await requestCode();
    const otp = screen.getByLabelText('Kode OTP') as HTMLInputElement;
    fireEvent.change(otp, { target: { value: '12ab34567890' } });
    expect(otp.value).toBe('123456');
    expect(screen.getByRole('button', { name: 'Verifikasi' })).toBeEnabled();
    fireEvent.change(otp, { target: { value: '123' } });
    expect(screen.getByRole('button', { name: 'Verifikasi' })).toBeDisabled();
  });

  it('shows a safe invalid-OTP state and lets the member retry', async () => {
    mockApi({
      '/api/v1/member-portal/auth/verify-otp': () =>
        json({ code: 'MEMBER_PORTAL_VERIFICATION_INVALID' }, 401),
    });
    renderPortal();
    await requestCode();
    fireEvent.change(screen.getByLabelText('Kode OTP'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verifikasi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kode belum sesuai atau sudah tidak berlaku',
    );
    expect(screen.getByLabelText('Kode OTP')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Rina' })).not.toBeInTheDocument();
  });

  it('prevents duplicate OTP requests while loading', async () => {
    let release!: () => void;
    const calls = mockApi({
      '/api/v1/member-portal/auth/request-otp': () =>
        new Promise<Response>((resolve) => {
          release = () =>
            resolve(json({ accepted: true, challengeId: 'c1', resendAfterSeconds: 60 }, 202));
        }),
    });
    renderPortal();
    await screen.findByRole('button', { name: 'Kirim kode OTP' });
    fireEvent.change(phoneInput(), { target: { value: '08192381923' } });
    const send = screen.getByRole('button', { name: 'Kirim kode OTP' });
    fireEvent.click(send);
    fireEvent.click(send);
    expect(await screen.findByRole('button', { name: 'Mengirim kode…' })).toBeDisabled();
    await waitFor(() => expect(release).toBeTypeOf('function'));
    await act(async () => release());
    await screen.findByLabelText('Kode OTP');
    expect(calls.filter((call) => call.url.endsWith('/auth/request-otp'))).toHaveLength(1);
  });

  it('enforces the resend cooldown then allows a resend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls = mockApi({
      '/api/v1/member-portal/auth/request-otp': () =>
        json({ accepted: true, challengeId: 'c1', resendAfterSeconds: 3 }, 202),
    });
    renderPortal();
    await requestCode();
    const resend = screen.getByRole('button', { name: /Kirim ulang kode dalam/ });
    expect(resend).toBeDisabled();
    for (let second = 0; second < 4; second += 1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    fireEvent.click(await screen.findByRole('button', { name: 'Kirim ulang kode' }));
    await waitFor(() =>
      expect(calls.filter((call) => call.url.endsWith('/auth/request-otp'))).toHaveLength(2),
    );
  });

  it('shows a delivery-unavailable message without provider detail', async () => {
    mockApi({
      '/api/v1/member-portal/auth/request-otp': () =>
        json({ code: 'VERIFICATION_DELIVERY_UNAVAILABLE' }, 503),
    });
    renderPortal();
    await screen.findByRole('button', { name: 'Kirim kode OTP' });
    fireEvent.change(phoneInput(), { target: { value: '08192381923' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim kode OTP' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Kode OTP belum dapat dikirim');
    expect(screen.queryByLabelText('Kode OTP')).not.toBeInTheDocument();
  });

  it('shows a technical connection message, not an identity hint, on a network or CORS failure', async () => {
    mockApi({
      '/api/v1/member-portal/auth/request-otp': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderPortal();
    await screen.findByRole('button', { name: 'Kirim kode OTP' });
    fireEvent.change(phoneInput(), { target: { value: '08192381923' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim kode OTP' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Tidak dapat terhubung ke server');
    expect(alert.textContent).not.toMatch(/terdaftar|member/i);
  });

  it('does not request an OTP when the deployment has no trusted business context', async () => {
    const calls = mockApi({
      '/runtime-config.json': () =>
        new Response(JSON.stringify({ ...bootstrap, workspaceResolution: { mode: 'LOGIN' } })),
    });
    renderPortal();
    await screen.findByRole('button', { name: 'Kirim kode OTP' });
    fireEvent.change(phoneInput(), { target: { value: '08192381923' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim kode OTP' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Portal member belum tersedia');
    expect(calls.some((call) => call.url.endsWith('/auth/request-otp'))).toBe(false);
  });
});

describe('authenticated portal', () => {
  it('loads the summary after verification with business branding and member identity', async () => {
    mockApi();
    renderPortal();
    await login();
    expect(screen.getByText('Salon Kita')).toBeInTheDocument();
    expect(screen.getByText(/Member M-0001/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Poin saya' })).toHaveTextContent('1.250');
    expect(screen.getByText('Aktif')).toBeInTheDocument();
  });

  it('makes the balance the primary element: hero first, recent activity next, navigation last', async () => {
    mockApi();
    renderPortal();
    await login();
    const hero = document.querySelector('.hero')!;
    expect(hero).toContainElement(screen.getByRole('region', { name: 'Poin saya' }));
    const order = [
      hero,
      screen.getByRole('region', { name: 'Aktivitas poin' }),
      screen.getByRole('region', { name: 'Transaksi terakhir' }),
      screen.getByRole('navigation', { name: 'Navigasi portal' }),
    ];
    order
      .slice(1)
      .forEach((node, index) =>
        expect(
          order[index]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy(),
      );
  });

  it('offers only the areas that exist today in the bottom navigation', async () => {
    mockApi();
    renderPortal();
    await login();
    const labels = within(screen.getByRole('navigation', { name: 'Navigasi portal' }))
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(labels).toEqual(['Beranda', 'Poin', 'Transaksi', 'Profil']);
    expect(document.body.textContent).not.toMatch(/Booking|Appointment|Promo|Layanan/i);
    expect(portalNav().getByRole('button', { name: 'Beranda' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows a zero balance and empty states without any filler content', async () => {
    mockApi(
      {
        '/api/v1/member-portal/summary': () => json({ ...summary, pointsBalance: '0.0000' }),
        '/api/v1/member-portal/points': () => json({ items: [] }),
        '/api/v1/member-portal/transactions': () => json({ items: [] }),
      },
      { signedIn: true },
    );
    renderPortal();
    expect(await screen.findByText('Belum ada aktivitas poin')).toBeInTheDocument();
    expect(screen.getByText('Belum ada transaksi')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Poin saya' })).toHaveTextContent('0');
  });

  it('shows a retryable error for a failed history load and keeps the balance visible', async () => {
    let fail = true;
    mockApi(
      {
        '/api/v1/member-portal/points': () =>
          fail ? json({ code: 'X' }, 500) : json({ items: pointRows.slice(0, 2) }),
      },
      { signedIn: true },
    );
    renderPortal();
    const retry = await screen.findByRole('button', { name: 'Coba lagi' });
    expect(screen.getByRole('region', { name: 'Poin saya' })).toHaveTextContent('1.250');
    fail = false;
    fireEvent.click(retry);
    expect((await screen.findAllByText('Poin diperoleh')).length).toBeGreaterThan(0);
  });

  it('shows the profile with a discoverable logout', async () => {
    mockApi();
    renderPortal();
    await login();
    openView('Profil');
    expect(await screen.findByText('Nomor member')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keluar dari portal' })).toBeInTheDocument();
    expect(portalNav().getByRole('button', { name: 'Profil' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shrinks a very large balance instead of wrapping it', async () => {
    mockApi(
      {
        '/api/v1/member-portal/summary': () => json({ ...summary, pointsBalance: '12500000.0000' }),
      },
      { signedIn: true },
    );
    renderPortal();
    const region = await screen.findByRole('region', { name: 'Poin saya' });
    expect(region.querySelector('.balance-value')).toHaveAttribute('data-size', 'sm');
    expect(region).toHaveTextContent('12.500.000');
  });

  it('shows the business name as a wordmark, with no logo mark or avatar, and a real logo only when configured', async () => {
    mockApi({}, { signedIn: true });
    const first = renderPortal();
    await memberHeading();
    expect(screen.getByText('Salon Kita')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Profil member' })).not.toBeInTheDocument();
    first.unmount();
    vi.resetModules();
    ({ MemberPortalApp: portalApp } = await import('./member-portal-app'));
    mockApi(
      {
        '/runtime-config.json': () =>
          new Response(
            JSON.stringify({
              ...bootstrap,
              branding: { ...bootstrap.branding, logoUrl: 'https://cdn.example.test/logo.svg' },
            }),
          ),
      },
      { signedIn: true },
    );
    renderPortal();
    await memberHeading();
    await waitFor(() =>
      expect(document.querySelector('img.portal-logo')).toHaveAttribute(
        'src',
        'https://cdn.example.test/logo.svg',
      ),
    );
  });

  it('keeps long member names and numbers inside the surface', async () => {
    mockApi(
      {
        '/api/v1/member-portal/summary': () =>
          json({
            ...summary,
            memberName: 'Ni Luh Putu Ayu Kusuma Dewi Wulandari Pratiwi Anggraeni',
            memberNumber: 'MBR-2026-000000012345',
          }),
      },
      { signedIn: true },
    );
    renderPortal();
    expect(await screen.findByText(/Ni Luh Putu/)).toBeInTheDocument();
    expect(screen.getByText(/MBR-2026-000000012345/)).toBeInTheDocument();
  });

  it('shows the poin history and the transaction history with customer-safe detail', async () => {
    mockApi();
    renderPortal();
    await login();
    expect(await screen.findAllByText('Poin diperoleh')).toHaveLength(2);
    openView('Transaksi');
    const row = await screen.findByText('INV-9');
    fireEvent.click(row);
    expect(await screen.findByText(/Potong rambut/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('shows a migrated opening balance as Saldo awal, never as a transaction', async () => {
    mockApi({
      '/api/v1/member-portal/points': () =>
        json({
          items: [
            {
              id: 'o1',
              type: 'OPENING_BALANCE',
              pointsDelta: '1250.0000',
              balanceAfter: '1250.0000',
              reference: null,
              createdAt: '2026-09-01T03:00:00.000Z',
            },
            pointRows[0],
          ],
        }),
    });
    renderPortal();
    await login();

    const label = (await screen.findAllByText('Saldo awal'))[0]!;
    const row = label.closest('li')!;
    expect(row.textContent).toContain('Saldo awal migrasi');
    expect(row.textContent).not.toContain('Transaksi');
    expect(row.textContent).toMatch(/\+1\.250/);
    // Sale-backed entries keep their labels and references.
    expect((await screen.findAllByText('Poin diperoleh')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/INV-0/).length).toBeGreaterThan(0);
  });

  it('loads more history in bounded pages', async () => {
    const calls = mockApi({
      '/api/v1/member-portal/points': () => json({ items: pointRows }),
    });
    renderPortal();
    await login();
    openView('Poin');
    fireEvent.click(await screen.findByRole('button', { name: 'Muat lebih banyak' }));
    await waitFor(() =>
      expect(calls.some((call) => call.url.includes('points?offset=20&limit=20'))).toBe(true),
    );
  });

  it('goes straight to the Member Portal when a valid session already exists', async () => {
    const calls = mockApi({}, { signedIn: true });
    renderPortal();
    expect(await memberHeading()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kirim kode OTP' })).not.toBeInTheDocument();
    expect(calls.some((call) => call.url.endsWith('/auth/request-otp'))).toBe(false);
    expect(JSON.stringify({ ...localStorage })).toBe('{}');
    expect(JSON.stringify({ ...sessionStorage })).toBe('{}');
  });

  it('requires OTP again after logout and a reload', async () => {
    mockApi({}, { signedIn: true });
    const first = renderPortal();
    await memberHeading();
    openView('Profil');
    fireEvent.click(await screen.findByRole('button', { name: 'Keluar dari portal' }));
    await screen.findByRole('button', { name: 'Kirim kode OTP' });
    first.unmount();
    renderPortal();
    expect(await screen.findByRole('button', { name: 'Kirim kode OTP' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Rina' })).not.toBeInTheDocument();
  });

  it('falls back to phone sign-in when the stored session is rejected on open', async () => {
    mockApi({
      '/api/v1/member-portal/summary': () => json({ code: 'MEMBER_PORTAL_SESSION_INVALID' }, 401),
    });
    renderPortal();
    expect(await screen.findByRole('button', { name: 'Kirim kode OTP' })).toBeInTheDocument();
  });

  it('shows an empty state instead of a blank list when there is no history', async () => {
    mockApi({ '/api/v1/member-portal/points': () => json({ items: [] }) }, { signedIn: true });
    renderPortal();
    expect(await screen.findByText('Belum ada aktivitas poin')).toBeInTheDocument();
  });

  it('returns to the login screen with an expired-session state when the session is rejected', async () => {
    mockApi({
      '/api/v1/member-portal/points': () => json({ code: 'MEMBER_PORTAL_SESSION_INVALID' }, 401),
    });
    renderPortal();
    await login();
    expect(await screen.findByText('Sesi Anda telah berakhir')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kembali ke awal' }));
    expect(await screen.findByRole('button', { name: 'Kirim kode OTP' })).toBeInTheDocument();
    expect(screen.queryByText(/Rina/)).not.toBeInTheDocument();
  });

  it('logs out and returns to phone login without private data', async () => {
    const calls = mockApi();
    renderPortal();
    await login();
    openView('Profil');
    fireEvent.click(await screen.findByRole('button', { name: 'Keluar dari portal' }));
    expect(await screen.findByRole('button', { name: 'Kirim kode OTP' })).toBeInTheDocument();
    expect(calls.some((call) => call.url.endsWith('/auth/logout'))).toBe(true);
    expect(screen.queryByText(/Rina|1\.250/)).not.toBeInTheDocument();
  });

  it('never stores a session credential in browser storage', async () => {
    mockApi();
    renderPortal();
    await login();
    expect(JSON.stringify({ ...localStorage })).toBe('{}');
    expect(JSON.stringify({ ...sessionStorage })).toBe('{}');
  });
});

describe('surface', () => {
  const css = readFileSync(join(__dirname, 'style.css'), 'utf8');

  it('keeps a compact centered desktop surface on brand-derived warm tokens', () => {
    expect(css).toContain('--portal-width: 440px');
    expect(css).toMatch(/@media \(min-width: 640px\)[^@]*align-items: center/);
    expect(css).toMatch(/max-width: var\(--portal-width\)/);
    expect(css).toMatch(/--portal-hero-a: color-mix\(in srgb, var\(--color-brand\)/);
    // Raw colors live only in the :root token block, never in component rules.
    expect(css.replace(/:root \{[^}]*\}/, '')).not.toMatch(/#[0-9a-f]{3,8}(?![0-9a-z])/i);
  });

  it('keeps the tonal hero and offers an optional business hero image slot', () => {
    expect(css).toContain('var(--portal-hero-image, none)');
    expect(css).toMatch(/linear-gradient\(162deg, var\(--portal-hero-a\)/);
  });

  it('carries no invented logo, avatar or generated artwork', () => {
    const views = readFileSync(join(__dirname, 'member-portal-views.tsx'), 'utf8');
    expect(views).not.toMatch(/<svg|HeroArt|portal-mark|avatar|initials|onProfile/);
    expect(css).not.toMatch(/portal-mark|avatar-button|hero-art/);
    expect(views).toContain('logoUrl');
  });

  it('carries no member link, QR, rotate or revoke access UI', () => {
    const source = readFileSync(join(__dirname, 'member-portal-app.tsx'), 'utf8');
    expect(source + css).not.toMatch(
      /Copy Link|Rotate Link|Revoke Link|Revoke Access|QR code|handle|INVALID_LINK/i,
    );
  });
});

describe('canonical /member access route', () => {
  const root = join(__dirname, '..', '..');
  const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

  it('renders the phone verification screen at /member and again after a refresh', async () => {
    mockApi();
    window.history.pushState({}, '', '/member');
    const first = renderPortal();
    expect(await screen.findByRole('button', { name: 'Kirim kode OTP' })).toBeInTheDocument();
    first.unmount();
    window.history.pushState({}, '', '/member');
    renderPortal();
    expect(await screen.findByRole('heading', { name: 'Selamat datang' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/member');
  });

  it('requires no member-specific path and never parses the pathname', () => {
    const sources = ['member-portal-app.tsx', 'member-portal-api.ts', 'src.tsx'].map((file) =>
      read('apps', 'member-portal', file),
    );
    expect(sources.join('\n')).not.toMatch(
      /location\.pathname|pathname\.split|useParams|\/member\/:|membershipId|customerId|tenantId|\?tenant/,
    );
  });

  it('mounts the built app at /member with the bootstrap beside it', () => {
    const vite = read('apps', 'member-portal', 'vite.config.ts');
    expect(vite).toContain("base: '/member/'");
    expect(vite).toContain('port: 5175');
    const nginx = read('deployment', 'nginx', 'member-portal.conf');
    expect(nginx).toContain('location = /member {');
    expect(nginx).toContain('try_files $uri $uri/ /member/index.html');
    expect(nginx).toContain('/member/runtime-config.json');
    expect(read('Dockerfile')).toContain('/usr/share/nginx/html/member/');
  });

  it('starts the Member Portal alone from dev:member and with the other apps from root dev', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['dev:member']).toBe('pnpm --filter @digvation/member-portal dev');
    expect(scripts['dev']).toContain('--filter @digvation/member-portal');
    expect(scripts['dev:operational']).not.toContain('member');
    expect(JSON.parse(read('apps', 'member-portal', 'package.json')).scripts.dev).toBe('vite');
  });

  it('resolves the FIXED workspace from the canonical bootstrap contract without secrets or ids', async () => {
    const raw = read('apps', 'member-portal', 'public', 'runtime-config.json');
    const { runtimeConfigSchema, resolveBootstrapWorkspace } =
      await import('@digvation/business-runtime');
    const config = runtimeConfigSchema.parse(JSON.parse(raw));
    expect(config.workspaceResolution).toEqual({ mode: 'FIXED', workspace: 'dgv-salon' });
    expect(resolveBootstrapWorkspace(config)).toBe('dgv-salon');
    expect(raw).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}|fonnte|token|secret|otp|tenantId|customerId|membershipId/i,
    );
  });

  it('keeps Fonnte and provider credentials out of the Web app', () => {
    const web = [
      'member-portal-app.tsx',
      'member-portal-api.ts',
      'src.tsx',
      'vite.config.ts',
      'index.html',
    ];
    for (const file of web)
      expect(read('apps', 'member-portal', file)).not.toMatch(
        /fonnte|FONNTE|whatsapp-provider|api\.fonnte/i,
      );
    const calls = readFileSync(join(__dirname, 'member-portal-api.ts'), 'utf8').match(
      /\/auth\/[a-z-]+/g,
    );
    expect(new Set(calls)).toEqual(
      new Set(['/auth/request-otp', '/auth/verify-otp', '/auth/logout']),
    );
  });
});
