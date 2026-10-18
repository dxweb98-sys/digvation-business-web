import { describe, expect, it } from 'vitest';

import {
  canAdjustOrder,
  correctionSourceOf,
  PROGRESSED_ADJUSTMENT_PERMISSION,
  saleLineAdjustmentMode,
} from './sale-adjustment-access';

const sale = (operationalState: string) => ({ operationalState }) as never;
const UPDATE = ['sales:update'];
const BOTH = ['sales:update', 'sales:adjust-progressed'];

describe('canAdjustOrder', () => {
  it('uses the canonical Runtime permission key', () => {
    expect(PROGRESSED_ADJUSTMENT_PERMISSION).toBe('sales:adjust-progressed');
  });

  it.each(['UNSUBMITTED', 'QUEUED'])('keeps the existing rules for a %s Sale', (state) => {
    expect(canAdjustOrder(sale(state), UPDATE)).toBe(true);
    expect(canAdjustOrder(sale(state), [])).toBe(true);
  });

  it('hides Adjust Order for an IN_PROGRESS Sale with only sales:update', () => {
    expect(canAdjustOrder(sale('IN_PROGRESS'), UPDATE)).toBe(false);
  });

  it('offers it with both permissions', () => {
    expect(canAdjustOrder(sale('IN_PROGRESS'), BOTH)).toBe(true);
  });

  it('still requires sales:update; the extra permission alone is not enough', () => {
    expect(canAdjustOrder(sale('IN_PROGRESS'), ['sales:adjust-progressed'])).toBe(false);
    expect(canAdjustOrder(sale('IN_PROGRESS'), [])).toBe(false);
  });
});

describe('saleLineAdjustmentMode', () => {
  const line = (status: string | null) => ({ fulfillment: status ? { status } : null }) as never;

  it.each(['UNSUBMITTED', 'QUEUED'])(
    'keeps ordinary editing for a not-yet-started line of a %s Sale',
    (state) => {
      expect(saleLineAdjustmentMode(sale(state), line('WAITING'))).toBe('EDIT');
      expect(saleLineAdjustmentMode(sale(state), line(null))).toBe('EDIT');
    },
  );

  it('routes an existing line of an IN_PROGRESS Sale through the audited correction', () => {
    expect(saleLineAdjustmentMode(sale('IN_PROGRESS'), line('IN_PROGRESS'))).toBe('CORRECTION');
    expect(saleLineAdjustmentMode(sale('IN_PROGRESS'), line('WAITING'))).toBe('CORRECTION');
    expect(saleLineAdjustmentMode(sale('IN_PROGRESS'), line(null))).toBe('CORRECTION');
  });

  it('never offers completed work for correction', () => {
    expect(saleLineAdjustmentMode(sale('IN_PROGRESS'), line('COMPLETED'))).toBe('LOCKED');
    expect(saleLineAdjustmentMode(sale('QUEUED'), line('COMPLETED'))).toBe('LOCKED');
  });
});

describe('correctionSourceOf', () => {
  const source = { id: 'source', itemNameSnapshot: 'Haircut' };
  const sale = { lines: [source, { id: 'replacement', correctedFromLineId: 'source' }] } as never;

  it('resolves the historical source of a corrected line on the same Sale only', () => {
    expect(correctionSourceOf(sale, { correctedFromLineId: 'source' })).toBe(source);
    expect(correctionSourceOf(sale, { correctedFromLineId: 'elsewhere' })).toBeNull();
    expect(correctionSourceOf(sale, { correctedFromLineId: null })).toBeNull();
    expect(correctionSourceOf(sale, {})).toBeNull();
  });
});
