import { describe, expect, it } from 'vitest';

import {
  notificationContext,
  notificationSeverityLabel,
  notificationTitle,
} from './operational-notification-bell';

const notification = {
  id: 'notification-1',
  category: 'FINANCE' as const,
  type: 'EXPENSE_APPROVED' as const,
  severity: 'WARNING' as const,
  displayData: {
    amount: '125000.00',
    currency: 'IDR',
    sellingLocationName: 'Kemang',
  },
  resourceType: 'expense',
  resourceId: 'expense-1',
  sellingLocationId: 'location-1',
  actionPath: '/expenses',
  createdAt: '2026-10-18T05:00:00.000Z',
  readAt: null,
};

describe('Operational notification formatting', () => {
  it('renders localized title, contextual IDR amount, and severity instead of notification enums', () => {
    expect(notificationTitle('id-ID', notification)).toBe('Pengeluaran disetujui');
    expect(
      notificationContext('id-ID', notification, (amount, currency) => `${currency} ${amount}`),
    ).toBe('IDR 125000.00 di Kemang telah disetujui.');
    expect(notificationSeverityLabel('id-ID', notification.severity)).toBe('Perlu perhatian');
  });
});
