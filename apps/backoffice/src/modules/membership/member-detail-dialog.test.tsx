import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemberDetailDialog } from './member-detail-dialog';
import { MembersApi, type Ledger, type Member } from './members-api';

const member: Member = {
  id: 'm1',
  customerId: 'c1',
  memberNumber: 'MBR-000007',
  status: 'INACTIVE',
  joinedAt: '2024-01-30T17:00:00.000Z',
  version: 2,
  customer: {
    id: 'c1',
    name: 'Ayu Lestari',
    phoneE164: '+6281234567890',
    version: 1,
    status: 'ACTIVE',
  },
};

const earned: Ledger = {
  id: 'l1',
  type: 'Points earned',
  pointsDelta: '20',
  balanceAfter: '120',
  sourceSaleId: 's1',
  reversesLedgerEntryId: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};

function renderDetail(canViewLoyalty: boolean, history: Ledger[] = [earned]) {
  const api = {
    get: vi.fn().mockResolvedValue(member),
    balance: vi.fn().mockResolvedValue({ membershipId: 'm1', pointsBalance: '120' }),
    history: vi.fn().mockResolvedValue(history),
  };
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemberDetailDialog
        memberId="m1"
        api={api}
        canViewLoyalty={canViewLoyalty}
        canEdit
        formatDate={(value) => `date:${value.slice(0, 10)}`}
        onEdit={vi.fn()}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return api;
}

afterEach(cleanup);

describe('MemberDetailDialog', () => {
  it('presents the Member in Catalog-family sections without inventing data', async () => {
    renderDetail(false);
    expect(await screen.findByText('Ayu Lestari')).toBeTruthy();
    expect(screen.getByText('Detail Member')).toBeTruthy();
    expect(screen.getByLabelText('Membership')).toBeTruthy();
    expect(screen.getAllByText('081234567890').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nonaktif').length).toBeGreaterThan(0);
    expect(screen.getByText('date:2024-01-30')).toBeTruthy();
  });

  it('never reads Loyalty data without Loyalty permission', async () => {
    const api = renderDetail(false);
    await screen.findByText('Ayu Lestari');
    expect(api.balance).not.toHaveBeenCalled();
    expect(api.history).not.toHaveBeenCalled();
    expect(screen.queryByText('Poin Loyalty')).toBeNull();
  });

  it('shows balance and history exactly as Runtime returns them with Loyalty permission', async () => {
    renderDetail(true);
    expect(await screen.findByText('Points earned')).toBeTruthy();
    expect(screen.getByText('Poin Loyalty')).toBeTruthy();
    expect(screen.getAllByText('120').length).toBeGreaterThan(0);
    expect(screen.getByText('+20')).toBeTruthy();
  });

  it('labels a migrated opening balance as such, with no transaction reference', async () => {
    renderDetail(true, [
      earned,
      {
        id: 'l0',
        type: 'Opening balance',
        pointsDelta: '1250',
        balanceAfter: '1250',
        sourceSaleId: null,
        reversesLedgerEntryId: null,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
    expect(await screen.findByText('Saldo awal migrasi')).toBeTruthy();
    expect(screen.getByText('+1250')).toBeTruthy();
    expect(screen.getByText('Saldo 1250')).toBeTruthy();
    // Never presented as earned points.
    expect(screen.getAllByText('Points earned')).toHaveLength(1);
  });
});

describe('MembersApi.history', () => {
  it('maps OPENING_BALANCE and keeps its null source Sale', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([
        {
          id: 'l0',
          type: 'OPENING_BALANCE',
          pointsDelta: '1250',
          balanceAfter: '1250',
          sourceSaleId: null,
          reversesLedgerEntryId: null,
          createdAt: '2026-08-01T00:00:00.000Z',
        },
        { ...earned, type: 'EARN' },
      ]),
    };
    const rows = await new MembersApi(client as never).history('m1');
    expect(rows.map((row) => [row.type, row.sourceSaleId])).toEqual([
      ['Opening balance', null],
      ['Points earned', 's1'],
    ]);
  });
});

describe('MemberDetailDialog point adjustments', () => {
  it('shows import and manual adjustment entries with their reason', async () => {
    renderDetail(true, [
      {
        ...earned,
        id: 'l2',
        type: 'Manual adjustment',
        pointsDelta: '-50',
        balanceAfter: '70',
        sourceSaleId: null,
        reason: 'Salah input',
      },
      { ...earned, id: 'l3', type: 'Imported points', sourceSaleId: null },
    ]);
    expect(await screen.findByText('Penyesuaian manual')).toBeTruthy();
    expect(screen.getByText('Alasan: Salah input')).toBeTruthy();
    expect(screen.getByText('Poin dari import')).toBeTruthy();
  });

  it('offers Sesuaikan poin only when allowed', async () => {
    const onAdjust = vi.fn();
    const renderWith = (canAdjustPoints: boolean) => {
      cleanup();
      const api = {
        get: vi.fn().mockResolvedValue(member),
        balance: vi.fn().mockResolvedValue({ membershipId: 'm1', pointsBalance: '120' }),
        history: vi.fn().mockResolvedValue([]),
      };
      render(
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <MemberDetailDialog
            memberId="m1"
            api={api}
            canViewLoyalty
            canEdit
            canAdjustPoints={canAdjustPoints}
            formatDate={(value) => value}
            onEdit={vi.fn()}
            onAdjustPoints={onAdjust}
            onClose={vi.fn()}
          />
        </QueryClientProvider>,
      );
    };
    renderWith(false);
    await screen.findByText('Detail Member');
    await screen.findByText('Riwayat Poin');
    expect(screen.queryByRole('button', { name: 'Sesuaikan poin' })).toBeNull();
    renderWith(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Sesuaikan poin' }));
    expect(onAdjust).toHaveBeenCalledWith(member);
  });
});
