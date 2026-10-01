import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemberDetailDialog } from './member-detail-dialog';
import type { Member } from './members-api';

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

function renderDetail(canViewLoyalty: boolean) {
  const api = {
    get: vi.fn().mockResolvedValue(member),
    balance: vi.fn().mockResolvedValue({ membershipId: 'm1', pointsBalance: '120' }),
    history: vi.fn().mockResolvedValue([
      {
        id: 'l1',
        type: 'Points earned',
        pointsDelta: '20',
        balanceAfter: '120',
        sourceSaleId: 's1',
        reversesLedgerEntryId: null,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ]),
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
});
