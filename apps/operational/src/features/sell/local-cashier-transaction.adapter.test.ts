import { createDecimal } from '@digvation/pos-money';
import { describe, expect, it } from 'vitest';

import { LocalCashierTransactionAdapter } from './local-cashier-transaction.adapter';

describe('LocalCashierTransactionAdapter', () => {
  it('rolls back the local boundary when an atomic draft line is invalid', async () => {
    const adapter = new LocalCashierTransactionAdapter();
    const branch = (await adapter.listSellingLocations()).items[0]!;
    const item = (await adapter.listCatalogItems()).items[0]!;

    await expect(
      adapter.startSale(
        {
          sellingLocationId: branch.id,
          currency: 'IDR',
          lines: [
            { catalogItemId: item.id, quantity: '1' },
            { catalogItemId: 'missing-item', quantity: '1' },
          ],
        },
        'atomic-rollback',
      ),
    ).rejects.toThrow();

    expect((await adapter.listSales()).items).toEqual([]);
  });

  it('runs the demo Sale lifecycle through the same transaction port', async () => {
    const adapter = new LocalCashierTransactionAdapter();
    const branch = (await adapter.listSellingLocations()).items[0]!;
    const items = (await adapter.listCatalogItems()).items;
    const hairStyling = items.find((item) => item.name === 'Hair Styling')!;
    const hairVariant = (await adapter.listCatalogVariants(hairStyling.id)).items.find(
      (variant) => variant.code === 'LONG',
    )!;
    const price = await adapter.resolvePrice({
      catalogItemId: hairStyling.id,
      catalogVariantId: hairVariant.id,
      sellingLocationId: branch.id,
      currency: 'IDR',
      effectiveAt: new Date().toISOString(),
    });
    expect(price.amount).toBe('165000.0000');

    let sale = await adapter.startSale(
      {
        sellingLocationId: branch.id,
        currency: 'IDR',
        lines: [
          {
            catalogItemId: hairStyling.id,
            catalogVariantId: hairVariant.id,
            quantity: '1',
          },
        ],
      },
      'start',
    );
    expect(sale.version).toBe(1);
    sale = await adapter.addSaleLine(
      sale.id,
      {
        expectedVersion: sale.version,
        catalogItemId: hairStyling.id,
        catalogVariantId: hairVariant.id,
        quantity: '1',
      },
      'add-duplicate',
    );
    expect(sale.lines).toHaveLength(1);
    expect(sale.lines[0]!.quantity).toBe('2.0000');

    sale = await adapter.setSaleLineQuantity(sale.id, sale.lines[0]!.id, {
      expectedVersion: sale.version,
      quantity: '3',
    });
    expect(sale.lines[0]!.quantity).toBe('3.0000');

    const product = items.find((item) => item.type === 'PRODUCT')!;
    sale = await adapter.addSaleLine(
      sale.id,
      { expectedVersion: sale.version, catalogItemId: product.id, quantity: '1' },
      'add-product',
    );
    const productLine = sale.lines.find((line) => line.catalogItemId === product.id)!;
    sale = await adapter.removeSaleLine(sale.id, productLine.id, sale.version);
    expect(sale.lines.find((line) => line.id === productLine.id)?.removedAt).not.toBeNull();

    const serviceLine = sale.lines.find((line) => line.catalogItemId === hairStyling.id)!;
    const employees = (await adapter.listEmployees()).items;
    sale = await adapter.setSaleLineAssignments(sale.id, serviceLine.id, {
      expectedVersion: sale.version,
      employeeIds: employees.slice(0, 2).map((employee) => employee.id),
    });
    sale = await adapter.setSaleLineContributions(sale.id, serviceLine.id, {
      expectedVersion: sale.version,
      contributors: employees.slice(0, 2).map((employee) => ({ employeeId: employee.id })),
    });
    const configuredLine = sale.lines.find((line) => line.id === serviceLine.id)!;
    expect(
      configuredLine.participations
        .reduce(
          (total, participation) => total.plus(createDecimal(participation.shareRate ?? '0')),
          createDecimal('0'),
        )
        .equals(1),
    ).toBe(true);

    sale = await adapter.transitionSaleLineFulfillment(sale.id, serviceLine.id, {
      expectedVersion: sale.version,
      status: 'IN_PROGRESS',
    });
    sale = await adapter.transitionSaleLineFulfillment(sale.id, serviceLine.id, {
      expectedVersion: sale.version,
      status: 'COMPLETED',
    });
    sale = await adapter.createSalePayment(
      sale.id,
      {
        expectedVersion: sale.version,
        method: 'CASH',
        appliedAmount: sale.totalAmount,
        tenderedAmount: sale.totalAmount,
      },
      'cash',
    );
    sale = await adapter.finalizeSale(sale.id, sale.version, 'finalize');
    expect(sale.status).toBe('FINALIZED');
    expect(sale.lines[0]!.contributions).toHaveLength(2);

    const newSale = await adapter.createSale(
      { sellingLocationId: branch.id, currency: 'IDR' },
      'new-sale',
    );
    expect(newSale.id).not.toBe(sale.id);
    expect(newSale.lines).toEqual([]);
    expect(newSale.payments).toEqual([]);
  });
});
