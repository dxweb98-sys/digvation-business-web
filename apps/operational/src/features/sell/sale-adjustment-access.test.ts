import { describe, expect, it } from 'vitest';

import { canAdjustOrder, PROGRESSED_ADJUSTMENT_PERMISSION } from './sale-adjustment-access';

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
