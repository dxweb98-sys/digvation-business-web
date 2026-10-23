import { describe, expect, it } from 'vitest';

import {
  adjustOrderDraft,
  emptyOrderAdjustmentDraft,
  orderAdjustmentInput,
  type OrderAdjustmentDraftAction,
} from './order-adjustment-draft';

const line = (catalogItemId: string, quantity = '1') => [{ catalogItemId, quantity }];
const apply = (...actions: OrderAdjustmentDraftAction[]) =>
  actions.reduce(adjustOrderDraft, emptyOrderAdjustmentDraft(3));

describe('order adjustment draft normalization', () => {
  it('proposes nothing until something changes', () => {
    expect(orderAdjustmentInput(emptyOrderAdjustmentDraft(3))).toBeNull();
  });

  it('keeps only the latest quantity of a line, and forgets a quantity back to the persisted one', () => {
    const changed = apply(
      { type: 'QUANTITY', lineId: 'l1', quantity: '2.0000', persistedQuantity: '1.0000' },
      { type: 'QUANTITY', lineId: 'l1', quantity: '3.0000', persistedQuantity: '1.0000' },
    );
    expect(changed.operations).toEqual([{ kind: 'QUANTITY', lineId: 'l1', quantity: '3.0000' }]);

    const back = adjustOrderDraft(changed, {
      type: 'QUANTITY',
      lineId: 'l1',
      quantity: '1',
      persistedQuantity: '1.0000',
    });
    expect(back.operations).toEqual([]);
  });

  it('lets a removal supersede an earlier quantity change of the same line', () => {
    const draft = apply(
      { type: 'QUANTITY', lineId: 'l1', quantity: '2', persistedQuantity: '1' },
      { type: 'REMOVE', lineId: 'l1' },
    );
    expect(draft.operations).toEqual([{ kind: 'REMOVE', lineId: 'l1' }]);
  });

  it('lets a replacement supersede earlier operations of that line and keeps its reason', () => {
    const draft = apply(
      { type: 'QUANTITY', lineId: 'l1', quantity: '2', persistedQuantity: '1' },
      { type: 'REPLACE', lineId: 'l1', lines: line('trim'), reason: 'Salah layanan' },
    );
    expect(draft.operations).toEqual([
      { kind: 'REPLACE', lineId: 'l1', lines: line('trim'), reason: 'Salah layanan' },
    ]);
  });

  it('edits an added item in place and forgets it entirely when it is removed again', () => {
    const added = apply(
      { type: 'ADD', clientKey: 'a', lines: line('sampo') },
      { type: 'EDIT_ADDED', clientKey: 'a', lines: line('sampo', '2') },
    );
    expect(added.operations).toEqual([{ kind: 'ADD', clientKey: 'a', lines: line('sampo', '2') }]);

    expect(adjustOrderDraft(added, { type: 'REMOVE_ADDED', clientKey: 'a' }).operations).toEqual(
      [],
    );
  });

  it('keeps changes to different lines apart and carries the base version', () => {
    const draft = apply(
      { type: 'REMOVE', lineId: 'l1' },
      { type: 'QUANTITY', lineId: 'l2', quantity: '4', persistedQuantity: '1' },
      { type: 'ADD', clientKey: 'a', lines: line('sampo') },
    );
    expect(orderAdjustmentInput(draft)).toEqual({
      expectedVersion: 3,
      operations: [
        { kind: 'REMOVE', lineId: 'l1' },
        { kind: 'QUANTITY', lineId: 'l2', quantity: '4' },
        { kind: 'ADD', clientKey: 'a', lines: line('sampo') },
      ],
    });
    expect(adjustOrderDraft(draft, { type: 'REBASE', baseVersion: 5 })).toMatchObject({
      baseVersion: 5,
      operations: draft.operations,
    });
  });
});
