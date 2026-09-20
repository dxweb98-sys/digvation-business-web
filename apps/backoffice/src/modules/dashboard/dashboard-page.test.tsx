import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@digvation/business-runtime', () => ({
  useRuntime: () => ({ apiBaseUrl: 'http://runtime.test', currency: 'IDR' }),
}));

vi.mock('@digvation/ui', () => ({
  DCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../app/layout/backoffice-page', () => ({
  BackofficePage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('../../app/localization/backoffice-localization', () => ({
  useBackofficeLocalization: () => ({
    locale: 'id',
    formatMoney: (value: string, currency: string) => `${currency} ${value}`,
  }),
}));

vi.mock('../../app/providers/business-location-context', () => ({
  useBusinessLocation: () => ({
    selectedLocationId: '00000000-0000-4000-8000-000000000010',
    isReady: true,
    isDenied: false,
  }),
}));

vi.mock('../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({
    session: {
      identity: {
        userId: 'user-1',
        displayName: 'Dicky',
        username: 'dicky',
        roles: [],
      },
      business: {
        tenantId: 'tenant-1',
        name: 'Digvation',
        currency: 'IDR',
      },
      access: {
        products: ['POS'],
        capabilities: ['FINANCE_OPERATIONS'],
        foundations: ['AUDIT_ACTIVITY'],
        permissions: ['sales:read', 'expenses:read', 'activity:read'],
      },
      preferences: {
        locale: 'id-ID',
        timezone: 'Asia/Jakarta',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm',
      },
      deployment: { profile: 'SHARED' },
      contextVersion: 'test-context',
    },
    createApiClient: () => ({}),
  }),
}));

vi.mock('./dashboard-api', () => ({
  DashboardApi: class {
    dailySummary() {
      return Promise.resolve({
        date: '2026-09-20',
        currency: 'IDR',
        income: '8849780.0000',
        expenses: '27540000.0000',
        netRevenue: '-18690220.0000',
        totalTransactions: 4,
        financeAvailable: true,
        transactionCompletion: { total: 5, finalized: 4, voided: 1 },
      });
    }

    report(type: string) {
      if (type === 'business-performance') {
        return Promise.resolve({
          summary: { finalRevenue: '100000.0000', transactionCount: 4 },
          analytics: {
            trend: [{ label: '2026-09-20', value: '100000.0000', count: 4 }],
            breakdown: [],
            breakdowns: {},
            ranking: [],
          },
          items: [],
          total: 0,
        });
      }
      if (type === 'expenses') {
        return Promise.resolve({
          summary: { approvedExpenseTotal: '25000.0000' },
          analytics: {
            trend: [{ label: '2026-09-20', value: '25000.0000', count: 1 }],
            breakdown: [],
            breakdowns: {},
            ranking: [],
          },
          items: [],
          total: 0,
        });
      }
      return Promise.resolve({
        summary: {},
        analytics: { trend: [], breakdown: [], breakdowns: {}, ranking: [] },
        items: [],
        total: 0,
      });
    }
  },
}));

vi.mock('./components/dashboard-kpi-card', () => ({
  DashboardKpiCard: ({ label, value }: { label: string; value: string }) => (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  ),
}));

vi.mock('./components/transaction-completion-card', () => ({
  TransactionCompletionCard: () => null,
}));

vi.mock('./components/ranking-card', () => ({ RankingCard: () => null }));
vi.mock('./components/payment-mix-card', () => ({ PaymentMixCard: () => null }));
vi.mock('./components/transactions-card', () => ({ TransactionsCard: () => null }));
vi.mock('./components/business-insight-widget', () => ({ BusinessInsightWidget: () => null }));

import { DashboardPage } from './dashboard-page';

describe('DashboardPage daily summary', () => {
  it('renders the four authoritative daily metrics and Activity label', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <DashboardPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Pemasukan hari ini')).toBeTruthy();
    expect(screen.getByText('Pengeluaran hari ini')).toBeTruthy();
    expect(screen.getByText('Revenue hari ini')).toBeTruthy();
    expect(screen.getByText('Total transaksi hari ini')).toBeTruthy();
    expect(screen.getByText('IDR 8849780.0000')).toBeTruthy();
    expect(screen.getByText('IDR 27540000.0000')).toBeTruthy();
    expect(screen.getByText('IDR -18690220.0000')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Aktivitas' })).toBeTruthy();
    expect(screen.getByText('Pemasukan')).toBeTruthy();
    expect(screen.getByText('Pengeluaran')).toBeTruthy();
    expect(screen.getByText('Transaksi')).toBeTruthy();
  });
});
