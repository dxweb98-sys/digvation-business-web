import { describe, expect, it } from 'vitest';

import {
  actorDisplayName,
  expenseCategoryLabel,
  expenseCategoryOptions,
  expenseDescription,
  expenseOriginLabel,
  expenseReferenceOptions,
  expenseStatusBadgeVariant,
  isExpenseSourceAccountType,
} from './expense-model';

const dictionary: Record<string, string> = {
  Operations: 'Operasional',
  Transport: 'Transportasi',
  Supplies: 'Perlengkapan',
  Other: 'Lainnya',
  Operational: 'Operasional',
};
const labels = { copy: (value: string) => dictionary[value] ?? value, locale: 'id' as const };

describe('Expense category presentation', () => {
  it('maps every known Runtime category code to localized copy', () => {
    expect(expenseCategoryLabel('OPERATIONS', labels)).toBe('Operasional');
    expect(expenseCategoryLabel('TRANSPORT', labels)).toBe('Transportasi');
    expect(expenseCategoryLabel('SUPPLIES', labels)).toBe('Perlengkapan');
    expect(expenseCategoryLabel('OTHER', labels)).toBe('Lainnya');
  });

  it('humanizes an unknown future code instead of showing raw enum text', () => {
    expect(expenseCategoryLabel('FUEL_COST', labels)).toBe('Fuel Cost');
  });

  it('offers the known codes as option values and keeps an unknown saved code selectable', () => {
    expect(expenseCategoryOptions(labels).map((option) => option.value)).toEqual([
      'OPERATIONS',
      'TRANSPORT',
      'SUPPLIES',
      'OTHER',
    ]);
    expect(expenseCategoryOptions(labels, 'FUEL_COST').at(-1)).toEqual({
      value: 'FUEL_COST',
      label: 'Fuel Cost',
    });
  });
});

describe('Expense presentation', () => {
  it('uses Runtime-projected display names rather than stable actor IDs', () => {
    expect(
      actorDisplayName(
        { id: '00000000-0000-4000-8000-000000000002', kind: 'user', displayName: 'Rina' },
        'Not set',
      ),
    ).toBe('Rina');
    expect(
      actorDisplayName(
        { id: 'expense-workflow', kind: 'machine', displayName: 'System' },
        'Not set',
      ),
    ).toBe('System');
    expect(actorDisplayName({ id: 'actor-1', kind: 'user', displayName: null }, 'Not set')).toBe(
      'Not set',
    );
    expect(actorDisplayName(null, 'Not set')).toBe('Not set');
  });

  it('localizes origin and keeps status badge semantics', () => {
    expect(expenseOriginLabel('OPERATIONAL', labels)).toBe('Operasional');
    expect(expenseStatusBadgeVariant('PENDING')).toBe('warning');
    expect(expenseStatusBadgeVariant('APPROVED')).toBe('success');
    expect(expenseStatusBadgeVariant('REJECTED')).toBe('secondary');
  });

  it('shows an intentional empty description', () => {
    expect(expenseDescription(null)).toBe('—');
    expect(expenseDescription('   ')).toBe('—');
    expect(expenseDescription('Bensin')).toBe('Bensin');
  });

  it('accepts only Runtime expense source account types', () => {
    expect(['CASH', 'BANK', 'E_WALLET', 'QRIS'].filter(isExpenseSourceAccountType)).toEqual([
      'CASH',
      'BANK',
      'E_WALLET',
    ]);
  });
});

describe('Expense filter reference options', () => {
  it('keeps names as configured, marks inactive records, and adds row-only references', () => {
    expect(
      expenseReferenceOptions(
        [
          { id: 'bca', name: 'BCA', status: 'ACTIVE' },
          { id: 'old', name: 'Kas Lama', status: 'INACTIVE' },
        ],
        [
          { id: 'bca', name: 'BCA' },
          { id: 'bni', name: 'BNI' },
        ],
        'Nonaktif',
      ),
    ).toEqual([
      { value: 'bca', label: 'BCA' },
      { value: 'old', label: 'Kas Lama (Nonaktif)' },
      { value: 'bni', label: 'BNI' },
    ]);
  });
});
