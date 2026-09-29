import { describe, expect, it } from 'vitest';

import type { WorkshopWorkOrderLine } from '../api/workshop-lines-api';
import {
  addDraftItems,
  adjustmentCount,
  adjustmentReady,
  buildAdjustmentInputs,
  draftQuantity,
  EMPTY_ADJUSTMENT_DRAFT,
  historyNewestFirst,
  replaceAddedItem,
  setLineQuantity,
  toggleLineRemoval,
} from './work-order-line-adjustment-model';
import type { DraftLine } from './work-order-lines-model';

const line = (id: string, quantity: string): WorkshopWorkOrderLine => ({
  id,
  position: 0,
  catalogItemId: `item-${id}`,
  catalogVariantId: null,
  itemCode: id,
  itemName: id,
  itemType: 'PRODUCT',
  variantCode: null,
  variantName: null,
  quantity,
  currency: 'IDR',
  unitPrice: '1000.0000',
  lineAmount: '1000.0000',
  components: [],
});

const added = (key: string, itemId: string, quantity = '1'): DraftLine => ({
  key,
  itemId,
  itemName: itemId,
  itemType: 'PRODUCT',
  variantId: null,
  variantName: null,
  quantity,
  unitPrice: null,
  includes: [],
  includedItemIds: [],
  requiresAdditional: false,
  additional: null,
});

const lines = [line('a', '1.0000'), line('b', '2.0000')];

describe('adjustment draft', () => {
  it('starts with no changes and nothing to save', () => {
    expect(buildAdjustmentInputs(lines, EMPTY_ADJUSTMENT_DRAFT)).toEqual([]);
    expect(adjustmentReady(lines, EMPTY_ADJUSTMENT_DRAFT)).toBe(false);
    expect(adjustmentCount(lines, EMPTY_ADJUSTMENT_DRAFT)).toBe(0);
  });

  it('treats a quantity typed back to the accepted value as no change', () => {
    const changed = setLineQuantity(EMPTY_ADJUSTMENT_DRAFT, lines[1]!, '5');
    expect(draftQuantity(lines[1]!, changed)).toBe('5');
    const reverted = setLineQuantity(changed, lines[1]!, '2');
    expect(draftQuantity(lines[1]!, reverted)).toBe('2.0000');
    expect(adjustmentReady(lines, reverted)).toBe(false);
  });

  it('keeps an invalid quantity visible and blocks saving instead of dropping it', () => {
    const draft = setLineQuantity(EMPTY_ADJUSTMENT_DRAFT, lines[0]!, '0');
    expect(draftQuantity(lines[0]!, draft)).toBe('0');
    expect(adjustmentReady(lines, draft)).toBe(false);
  });

  it('builds ordered semantic changes: existing Lines first, then additions', () => {
    let draft = setLineQuantity(EMPTY_ADJUSTMENT_DRAFT, lines[0]!, '3');
    draft = toggleLineRemoval(draft, 'b');
    draft = addDraftItems(draft, [added('n1', 'oil', '2')]);
    expect(buildAdjustmentInputs(lines, draft)).toEqual([
      { type: 'QUANTITY_CHANGE', lineId: 'a', quantity: '3' },
      { type: 'REMOVE', lineId: 'b' },
      { type: 'ADD', catalogItemId: 'oil', quantity: '2' },
    ]);
    expect(adjustmentReady(lines, draft)).toBe(true);
    expect(adjustmentCount(lines, draft)).toBe(3);
  });

  it('a removal wins over a staged quantity and can be restored', () => {
    let draft = setLineQuantity(EMPTY_ADJUSTMENT_DRAFT, lines[1]!, '9');
    draft = toggleLineRemoval(draft, 'b');
    expect(buildAdjustmentInputs(lines, draft)).toEqual([{ type: 'REMOVE', lineId: 'b' }]);
    draft = toggleLineRemoval(draft, 'b');
    expect(buildAdjustmentInputs(lines, draft)).toEqual([
      { type: 'QUANTITY_CHANGE', lineId: 'b', quantity: '9' },
    ]);
  });

  it('merges the same added selection instead of duplicating it and can drop an addition', () => {
    let draft = addDraftItems(EMPTY_ADJUSTMENT_DRAFT, [added('n1', 'oil', '1')]);
    draft = addDraftItems(draft, [added('n2', 'oil', '2')]);
    expect(draft.added).toHaveLength(1);
    expect(draft.added[0]?.quantity).toBe('3');
    expect(replaceAddedItem(draft, 'n1', null).added).toEqual([]);
  });

  it('does not save while an added item has an invalid quantity', () => {
    const draft = addDraftItems(EMPTY_ADJUSTMENT_DRAFT, [added('n1', 'oil', '0')]);
    expect(adjustmentReady(lines, draft)).toBe(false);
  });

  it('does not mutate the accepted Lines', () => {
    const before = JSON.stringify(lines);
    buildAdjustmentInputs(lines, toggleLineRemoval(EMPTY_ADJUSTMENT_DRAFT, 'a'));
    expect(JSON.stringify(lines)).toBe(before);
  });
});

describe('historyNewestFirst', () => {
  it('orders by Runtime sequence, newest first, without mutating the input', () => {
    const entries = [{ sequence: 1 }, { sequence: 3 }, { sequence: 2 }] as never[];
    expect(
      historyNewestFirst(entries).map((entry: { sequence: number }) => entry.sequence),
    ).toEqual([3, 2, 1]);
    expect(entries[0]).toEqual({ sequence: 1 });
  });
});
