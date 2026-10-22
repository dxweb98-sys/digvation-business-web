import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { backofficeCopy } from '../../../app/localization/backoffice-localization-copy';

vi.mock('@digvation/ui', () => ({
  DCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  DBadge: ({ children, variant }: { children: ReactNode; variant: string }) => (
    <span data-testid="status" data-variant={variant}>
      {children}
    </span>
  ),
}));

// The real Indonesian copy, so the test reads what people read.
vi.mock('../../../app/localization/backoffice-localization', () => ({
  useBackofficeLocalization: () => ({ copy: (key: string) => backofficeCopy[key]?.id ?? key }),
}));

vi.mock('../dashboard-i18n', () => ({
  useDashboardI18n: () => ({ locale: 'id', text: (key: string) => key }),
}));

vi.mock('./dashboard-card-header', () => ({
  DashboardCardHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
}));

import { TransactionsCard } from './transactions-card';

describe('TransactionsCard status', () => {
  it('names each Sale open, completed or cancelled with its semantic badge, never "finalisasi"', () => {
    render(
      <TransactionsCard
        title="Transaksi terakhir"
        periodLabel="Hari ini"
        total={4}
        transactions={[
          { saleNumber: 'TRX-1', saleStatus: 'OPEN', reversed: 'NO', total: '1' },
          { saleNumber: 'TRX-2', saleStatus: 'FINALIZED', reversed: 'NO', total: '1' },
          { saleNumber: 'TRX-3', saleStatus: 'VOIDED', reversed: 'NO', total: '1' },
          { saleNumber: 'TRX-4', saleStatus: 'FINALIZED', reversed: 'YES', total: '1' },
        ]}
        emptyMessage="Kosong"
        formatDateTime={() => '22 Okt 2026'}
        formatMoney={(value) => `Rp ${value}`}
      />,
    );
    const badges = screen
      .getAllByTestId('status')
      .map((badge) => [badge.textContent, badge.getAttribute('data-variant')]);
    expect(badges).toEqual([
      ['Terbuka', 'info'],
      ['Selesai', 'success'],
      ['Dibatalkan', 'danger'],
      // Reversed after completion reads as cancelled; the detail lives in Transaction History.
      ['Dibatalkan', 'danger'],
    ]);
    expect(document.body.textContent).not.toMatch(/finalisasi|setelah selesai/i);
  });
});
