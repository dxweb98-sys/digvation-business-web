import type { Expense } from '../api/expense-api';

export function testExpense(change: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    sellingLocationId: 'location-1',
    sellingLocationName: 'Toko Pusat',
    financialAccountId: 'bca-account',
    financialAccountName: 'BCA',
    financialAccountType: 'BANK',
    origin: 'BACKOFFICE',
    categoryCode: 'TRANSPORT',
    status: 'PENDING',
    currency: 'IDR',
    amount: '150000',
    note: 'Bensin pengiriman',
    occurredAt: '2026-10-01T02:00:00.000Z',
    version: 1,
    createdByActorId: 'user-1',
    createdBy: { id: 'user-1', kind: 'user', displayName: 'Rina' },
    approvedAt: null,
    approvedByActorId: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedByActorId: null,
    rejectedBy: null,
    rejectionNote: null,
    ...change,
  };
}
