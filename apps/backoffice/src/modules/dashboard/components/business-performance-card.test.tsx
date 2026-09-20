import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@digvation/ui', () => ({
  DCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

vi.mock('../dashboard-i18n', () => ({
  useDashboardI18n: () => ({
    locale: 'id',
    text: (key: string) =>
      ({
        revenue: 'Pemasukan',
        expenses: 'Pengeluaran',
        netRevenue: 'Revenue',
        transactions: 'Transaksi',
        transactionMovement: 'Pergerakan pemasukan, pengeluaran, dan transaksi',
      })[key] ?? key,
  }),
}));

import { BusinessPerformanceCard } from './business-performance-card';

describe('BusinessPerformanceCard', () => {
  it('shows selected-period Runtime Revenue in the summary without adding a chart series', () => {
    const onPeriodChange = vi.fn();
    const { container } = render(
      <BusinessPerformanceCard
        title="Aktivitas"
        period="month"
        periodOptions={[
          { value: 'month', label: 'Bulan' },
          { value: 'year', label: 'Tahun' },
        ]}
        onPeriodChange={onPeriodChange}
        revenue={8849780}
        expenses={27540000}
        netRevenue={-18690220}
        transactions={25}
        previousRevenue={0}
        previousExpenses={0}
        previousNetRevenue={0}
        previousTransactions={0}
        trend={[{ label: '2026-09-20', value: '8849780.0000', count: 25 }]}
        expenseTrend={[{ label: '2026-09-20', value: '27540000.0000', count: 1 }]}
        showExpenses
        formatMoney={(value) => `Rp ${value}`}
      />,
    );

    expect(screen.getByText('Pemasukan')).toBeTruthy();
    expect(screen.getByText('Pengeluaran')).toBeTruthy();
    expect(screen.getByText('Revenue')).toBeTruthy();
    expect(screen.getByText('Rp -18690220')).toBeTruthy();
    expect(screen.getByText('Transaksi')).toBeTruthy();
    expect(container.querySelectorAll('path[stroke]')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Tahun' }));
    expect(onPeriodChange).toHaveBeenCalledWith('year');
  });
});
