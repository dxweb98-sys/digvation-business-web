import { describe, expect, it } from 'vitest';

import { additionSignature, startAddition } from './cart-draft';
import type { SaleLine } from './cashier-transaction.types';
import { additionPerformedBy, saleLineAdditions, saleLineConfiguration } from './sale-line-additions';

const copy = (value: string) =>
  ({ 'Performed by': 'Dikerjakan oleh', Employee: 'Karyawan' })[value] ?? value;
const employees = [
  { id: 'emp-heru', displayName: 'Pak Heru' },
  { id: 'emp-rindu', displayName: 'Rindu' },
];
const line = {
  catalogVariantId: null,
  quantity: '1.0000',
  soldByEmployeeId: null,
  soldByEmployeeNameSnapshot: null,
  compositionComponents: [
    {
      id: 'fixed-cap',
      componentSource: 'FIXED_BOM',
      componentItemId: 'cap',
      componentVariantId: null,
      itemNameSnapshot: 'Hair Cap',
      variantNameSnapshot: null,
      quantity: '1.0000',
      transactionUnitPrice: null,
      extendedContribution: '0.0000',
    },
    {
      id: 'red',
      componentSource: 'SALE_SELECTED',
      componentItemId: 'red-coloring',
      componentVariantId: null,
      itemNameSnapshot: 'Red Coloring BRAND',
      variantNameSnapshot: null,
      quantity: '1.0000',
      transactionUnitPrice: '10000.0000',
      extendedContribution: '10000.0000',
      performers: [
        { employeeId: 'emp-heru', shareRate: '0.5' },
        { employeeId: 'emp-rindu', shareRate: '0.5' },
      ],
    },
  ],
} as unknown as SaleLine;

describe('Service additional item work in Web', () => {
  it('names who performs an addition and nothing for an unassigned one', () => {
    const [red] = saleLineAdditions(line);
    expect(red!.performerIds).toEqual(['emp-heru', 'emp-rindu']);
    expect(additionPerformedBy(red!, employees, copy)).toBe('Dikerjakan oleh Pak Heru, Rindu');
    expect(additionPerformedBy({ performerIds: [] }, employees, copy)).toBeNull();
    expect(additionPerformedBy({ performerIds: ['gone'] }, employees, copy)).toBe(
      'Dikerjakan oleh Karyawan',
    );
  });

  it('reopens a line with its addition performers, and never a salesperson for them', () => {
    const configuration = saleLineConfiguration(line, employees);
    expect(configuration.soldBy).toBeNull();
    expect(configuration.additionalComponents).toEqual([
      expect.objectContaining({
        componentItemId: 'red-coloring',
        performers: [
          { employeeId: 'emp-heru', name: 'Pak Heru' },
          { employeeId: 'emp-rindu', name: 'Rindu' },
        ],
      }),
    ]);
  });

  it('sends performers with the addition only when someone performs it', () => {
    const base = { componentItemId: 'red', quantity: '1.0000', label: 'Red', unitPrice: '10000.0000' };
    expect(startAddition(base)).toEqual({ componentItemId: 'red', quantity: '1.0000' });
    expect(
      startAddition({ ...base, performers: [{ employeeId: 'emp-heru', name: 'Pak Heru' }] }),
    ).toEqual({ componentItemId: 'red', quantity: '1.0000', performers: [{ employeeId: 'emp-heru' }] });
  });

  it('treats different performers as a different unit configuration, in any order', () => {
    const base = { componentItemId: 'red', quantity: '1.0000', label: 'Red', unitPrice: '10000.0000' };
    const heru = { employeeId: 'emp-heru', name: 'Pak Heru' };
    const rindu = { employeeId: 'emp-rindu', name: 'Rindu' };
    expect(additionSignature([{ ...base, performers: [heru] }])).not.toBe(
      additionSignature([{ ...base, performers: [rindu] }]),
    );
    expect(additionSignature([{ ...base, performers: [heru, rindu] }])).toBe(
      additionSignature([{ ...base, performers: [rindu, heru] }]),
    );
  });
});
