import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  Member,
  MemberDetail,
  MemberPage,
  OperationalMembersApi,
} from './operational-members-api';
import { OperationalMembersView } from './operational-members-page';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

afterEach(cleanup);

const rina: Member = {
  id: 'membership-1',
  customerId: 'customer-1',
  customer: {
    id: 'customer-1',
    name: 'Rina Wijaya',
    phoneE164: '+6281234567890',
    status: 'ACTIVE',
    version: 3,
  },
  memberNumber: 'MEMBER-001',
  status: 'ACTIVE',
  joinedAt: '2026-09-01T00:00:00.000Z',
};
const budi: Member = {
  ...rina,
  id: 'membership-2',
  customerId: 'customer-2',
  customer: {
    ...rina.customer,
    id: 'customer-2',
    name: 'Budi Santoso',
    phoneE164: '+6281900000001',
  },
  memberNumber: 'MEMBER-002',
  status: 'INACTIVE',
};

const detailFor = (member: Member): MemberDetail => ({
  membership: member,
  loyalty: {
    pointsBalance: '118.0000',
    recentActivity: [
      {
        id: 'e4',
        type: 'EARN_REVERSAL',
        pointsDelta: '-6.0000',
        balanceAfter: '118.0000',
        sourceSaleId: 's1',
        reversesLedgerEntryId: 'e1',
        createdAt: '2026-09-28T04:00:00.000Z',
      },
      {
        id: 'e3',
        type: 'REDEEM_REVERSAL',
        pointsDelta: '4.0000',
        balanceAfter: '124.0000',
        sourceSaleId: 's1',
        reversesLedgerEntryId: 'e2',
        createdAt: '2026-09-28T03:00:00.000Z',
      },
      {
        id: 'e2',
        type: 'REDEEM',
        pointsDelta: '-4.0000',
        balanceAfter: '120.0000',
        sourceSaleId: 's1',
        reversesLedgerEntryId: null,
        createdAt: '2026-09-28T02:00:00.000Z',
      },
      {
        id: 'e1',
        type: 'EARN',
        pointsDelta: '6.0000',
        balanceAfter: '124.0000',
        sourceSaleId: 's1',
        reversesLedgerEntryId: null,
        createdAt: '2026-09-28T01:00:00.000Z',
      },
    ],
  },
  latestTransaction: {
    saleId: 's1',
    saleNumber: 'TRX-20260928-000012',
    currency: 'IDR',
    totalAmount: '197580.0000',
    finalizedAt: '2026-09-28T02:15:00.000Z',
    pointsEarned: '6.0000',
    pointsRedeemed: '4.0000',
  },
});

function fakeApi(overrides: Partial<Record<keyof OperationalMembersApi, unknown>> = {}) {
  const page = (items: Member[]): MemberPage => ({
    items,
    total: items.length,
    limit: 20,
    offset: 0,
  });
  const api = {
    list: vi.fn().mockResolvedValue(page([rina, budi])),
    detail: vi
      .fn()
      .mockImplementation((id: string) => Promise.resolve(detailFor(id === budi.id ? budi : rina))),
    updateProfile: vi.fn().mockResolvedValue(rina.customer),
    ...overrides,
  };
  return api as unknown as OperationalMembersApi & typeof api;
}

function renderView(api: OperationalMembersApi, canEdit = false) {
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <DToastProvider>
          <OperationalMembersView api={api} canEdit={canEdit} />
        </DToastProvider>
      </QueryClientProvider>
    </DeploymentBootstrapProvider>,
  );
}

const openRina = async () => {
  fireEvent.click((await screen.findAllByText('Rina Wijaya'))[0]!);
  return screen.findByRole('dialog', { name: 'Detail Member' });
};

describe('Operational Member list', () => {
  it('shows bounded member rows with name, phone, member number and localized status', async () => {
    const api = fakeApi();
    renderView(api);

    // DDataTable renders a desktop table and a mobile card list, so each value appears in both.
    expect((await screen.findAllByText('Rina Wijaya')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('+6281234567890').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MEMBER-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aktif').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nonaktif').length).toBeGreaterThan(0);
    // Bounded first page, no point-balance request per row.
    expect(api.list).toHaveBeenCalledWith({ q: '', offset: 0 }, expect.anything());
    expect(api.detail).not.toHaveBeenCalled();
  });

  it('searches through the canonical query once typing pauses', async () => {
    const api = fakeApi();
    renderView(api);
    await screen.findAllByText('Rina Wijaya');

    fireEvent.change(screen.getAllByPlaceholderText('Cari nama, nomor member, atau telepon')[0]!, {
      target: { value: 'rina' },
    });

    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith({ q: 'rina', offset: 0 }, expect.anything()),
    );
    const calls = (api.list as unknown as { mock: { calls: [{ q?: string }][] } }).mock.calls;
    expect(calls.filter(([input]) => input.q === 'r')).toHaveLength(0);
  });

  it('distinguishes an empty directory from a search with no result', async () => {
    const api = fakeApi({ list: vi.fn().mockResolvedValue({ items: [], total: 0 }) });
    renderView(api);
    expect((await screen.findAllByText('Belum ada member.')).length).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByPlaceholderText('Cari nama, nomor member, atau telepon')[0]!, {
      target: { value: 'zzz' },
    });
    expect(
      (await screen.findAllByText('Tidak ada member yang cocok dengan pencarian.')).length,
    ).toBeGreaterThan(0);
  });

  it('offers a recoverable error and retries the list', async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ items: [rina], total: 1 });
    renderView(fakeApi({ list }));

    expect(await screen.findByText('Daftar member tidak dapat dimuat.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /coba lagi|retry/i }));

    expect((await screen.findAllByText('Rina Wijaya')).length).toBeGreaterThan(0);
  });
});

describe('Operational Member detail', () => {
  it('shows identity and the authoritative balance above two tabs, defaulting to point activity', async () => {
    const api = fakeApi();
    renderView(api);
    const dialog = within(await openRina());

    expect(api.detail).toHaveBeenCalledWith('membership-1', expect.anything());
    expect(await dialog.findByText('MEMBER-001')).toBeTruthy();
    expect(dialog.getByText('+6281234567890')).toBeTruthy();
    expect(dialog.getByText('Poin saat ini')).toBeTruthy();
    expect(dialog.getAllByText('118').length).toBeGreaterThan(0);

    const tabs = dialog.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Aktivitas Poin', 'Transaksi']);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(dialog.queryByRole('tab', { name: /profil/i })).toBeNull();
    expect(dialog.getAllByRole('listitem')).toHaveLength(4);
  });

  it('moves transaction context into its own tab', async () => {
    renderView(fakeApi());
    const dialog = within(await openRina());
    await dialog.findByText('MEMBER-001');

    expect(dialog.queryByText('TRX-20260928-000012')).toBeNull();
    fireEvent.click(dialog.getByRole('tab', { name: 'Transaksi' }));

    expect(await dialog.findByText('TRX-20260928-000012')).toBeTruthy();
    expect(dialog.getByText(/197[.,]580/)).toBeTruthy();
    expect(dialog.getByText('Poin diperoleh dari transaksi ini')).toBeTruthy();
    expect(dialog.getByText('Poin digunakan pada transaksi ini')).toBeTruthy();
  });

  it('keeps ledger direction obvious, with reversals as their own compensating entries', async () => {
    renderView(fakeApi());
    const dialog = within(await openRina());

    await dialog.findByRole('tab', { name: 'Aktivitas Poin' });
    const rows = dialog.getAllByRole('listitem').map((row) => row.textContent ?? '');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain('Poin perolehan dibatalkan');
    expect(rows[0]).toMatch(/[-−]6/);
    expect(rows[1]).toContain('Poin dikembalikan');
    expect(rows[1]).toMatch(/\+4/);
    expect(rows[2]).toContain('Poin digunakan');
    expect(rows[2]).toMatch(/[-−]4/);
    expect(rows[3]).toContain('Poin diperoleh');
    expect(rows[3]).toMatch(/\+6/);
  });

  it('omits the loyalty section when Loyalty Points is not entitled and handles no transaction', async () => {
    const detail = vi.fn().mockResolvedValue({
      membership: rina,
      loyalty: null,
      latestTransaction: null,
    });
    renderView(fakeApi({ detail }));
    const dialog = within(await openRina());

    expect(await dialog.findByText('Belum ada transaksi selesai.')).toBeTruthy();
    expect(dialog.queryByText('Poin saat ini')).toBeNull();
    expect(dialog.queryByRole('tab', { name: 'Aktivitas Poin' })).toBeNull();
  });

  it('keeps Tutup and Ubah data in the DDialog footer, outside any scrolling region', async () => {
    renderView(fakeApi(), true);
    const dialog = within(await openRina());
    await dialog.findByText('MEMBER-001');

    for (const name of ['Tutup', 'Ubah data']) {
      const button = dialog.getByRole('button', { name });
      expect(button.closest('.overflow-y-auto')).toBeNull();
    }
  });

  it('scrolls only the active tab panel, keeping summary and tab controls out of the scroll', async () => {
    renderView(fakeApi());
    const dialog = within(await openRina());
    await dialog.findByText('MEMBER-001');

    const panel = dialog.getByRole('tabpanel');
    expect(panel.className).toContain('overflow-y-auto');
    // Summary, balance and tab controls are outside the tab panel that scrolls.
    expect(panel.contains(dialog.getByRole('tablist'))).toBe(false);
    expect(panel.contains(dialog.getByText('Poin saat ini'))).toBe(false);
    expect(panel.contains(dialog.getByText('MEMBER-001'))).toBe(false);

    fireEvent.click(dialog.getByRole('tab', { name: 'Transaksi' }));
    expect(dialog.getByRole('tabpanel').className).toContain('overflow-y-auto');
  });

  it('keeps the list visible behind a recoverable detail error', async () => {
    const detail = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(detailFor(rina));
    renderView(fakeApi({ detail }));
    const dialog = within(await openRina());

    expect(await dialog.findByText('Detail member tidak dapat dimuat.')).toBeTruthy();
    expect(screen.getAllByText('Budi Santoso').length).toBeGreaterThan(0);
    fireEvent.click(dialog.getByRole('button', { name: /coba lagi|retry/i }));
    expect(await dialog.findByText('MEMBER-001')).toBeTruthy();
  });
});

describe('Operational Member profile editing', () => {
  it('offers no edit action to a read-only user', async () => {
    renderView(fakeApi(), false);
    const dialog = within(await openRina());
    await dialog.findByText('MEMBER-001');

    expect(dialog.queryByRole('button', { name: 'Ubah data' })).toBeNull();
  });

  it('lets an authorized user edit, saves through the canonical update and refreshes without reload', async () => {
    let current = rina;
    const api = fakeApi({
      list: vi.fn().mockImplementation(() => Promise.resolve({ items: [current, budi], total: 2 })),
      detail: vi.fn().mockImplementation(() => Promise.resolve(detailFor(current))),
      updateProfile: vi
        .fn()
        .mockImplementation((target: Member, input: { name: string; phone: string }) => {
          current = { ...rina, customer: { ...rina.customer, name: input.name, version: 4 } };
          return Promise.resolve(current.customer);
        }),
    });
    renderView(api, true);
    const dialog = within(await openRina());

    fireEvent.click(await dialog.findByRole('button', { name: 'Ubah data' }));
    fireEvent.change(dialog.getByLabelText('Nama'), { target: { value: 'Rina Wijaya Putri' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'customer-1' }),
        { name: 'Rina Wijaya Putri', phone: '+6281234567890' },
      ),
    );
    expect((await dialog.findAllByText('Rina Wijaya Putri')).length).toBeGreaterThan(0);
    expect(await screen.findAllByText('Rina Wijaya Putri')).not.toHaveLength(0);
    expect(dialog.queryByRole('button', { name: 'Simpan' })).toBeNull();
  });

  it('keeps the form open with concise feedback when Runtime rejects the update', async () => {
    const api = fakeApi({ updateProfile: vi.fn().mockRejectedValue(new Error('422')) });
    renderView(api, true);
    const dialog = within(await openRina());

    fireEvent.click(await dialog.findByRole('button', { name: 'Ubah data' }));
    fireEvent.change(dialog.getByLabelText('Nomor telepon'), { target: { value: '0812' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    expect(await dialog.findByText(/Data member tidak dapat diperbarui/)).toBeTruthy();
    expect(dialog.getByRole('button', { name: 'Simpan' })).toBeTruthy();
  });

  it('does not offer to edit points, ledger, member number or NIK', async () => {
    renderView(fakeApi(), true);
    const dialog = within(await openRina());
    fireEvent.click(await dialog.findByRole('button', { name: 'Ubah data' }));

    expect(
      dialog.getAllByRole('textbox').map((field) => (field as HTMLInputElement).value),
    ).toEqual(['Rina Wijaya', '+6281234567890']);
    expect(dialog.queryByLabelText(/NIK|poin|member/i)).toBeNull();
  });
});
