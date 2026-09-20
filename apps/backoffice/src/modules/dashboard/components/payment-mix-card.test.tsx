import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@digvation/ui', () => ({
  DCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

vi.mock('../../../app/localization/backoffice-localization', () => ({
  useBackofficeLocalization: () => ({ copy: (value: string) => value }),
}));

vi.mock('../dashboard-i18n', () => ({
  useDashboardI18n: () => ({ text: (key: string) => (key === 'totalValue' ? 'total nilai' : key) }),
}));

vi.mock('./dashboard-card-header', () => ({
  DashboardCardHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
}));

import { PaymentMixCard } from './payment-mix-card';

describe('PaymentMixCard', () => {
  it('centers the existing donut and keeps payment breakdown below it', () => {
    const { container } = render(
      <PaymentMixCard
        title="Komposisi pembayaran"
        points={[
          { label: 'Tunai', value: '84600.0000' },
          { label: 'Transfer bank', value: '15400.0000' },
        ]}
        emptyMessage="Tidak ada data"
        formatValue={(value) => `Rp ${value}`}
      />,
    );

    expect(container.querySelector('.flex.flex-col.items-center')).toBeTruthy();
    expect(container.querySelector('.w-full.space-y-3')).toBeTruthy();
    expect(screen.getByText('Tunai')).toBeTruthy();
    expect(screen.getByText('84.6%')).toBeTruthy();
    expect(screen.getByText('Transfer bank')).toBeTruthy();
    expect(screen.getByText('15.4%')).toBeTruthy();
    expect(screen.getByText('Rp 100000')).toBeTruthy();
  });
});
