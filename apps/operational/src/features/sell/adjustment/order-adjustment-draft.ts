import { createDecimal } from '@digvation/pos-money';
import type {
  OrderAdjustmentInput,
  OrderAdjustmentOperation,
  ReplaceSaleLineInput,
} from '../transaction/api/cashier-transaction.adapter';

/**
 * An order adjustment as the operator builds it: proposed changes against the persisted Sale
 * version they were made from. It lives only in the dialog; nothing is saved until the whole draft
 * is committed, and discarding it changes nothing.
 */
export interface OrderAdjustmentDraft {
  baseVersion: number;
  operations: OrderAdjustmentOperation[];
}

type Lines = ReplaceSaleLineInput['lines'];

export type OrderAdjustmentDraftAction =
  /** A new item, configured in the shared item configuration. */
  | { type: 'ADD'; clientKey: string; lines: Lines }
  /** A changed configuration of an item added in this draft. */
  | { type: 'EDIT_ADDED'; clientKey: string; lines: Lines }
  /** An item added in this draft is taken out again: the draft forgets it. */
  | { type: 'REMOVE_ADDED'; clientKey: string }
  /** A new quantity for a persisted line; back to its persisted quantity means no change. */
  | { type: 'QUANTITY'; lineId: string; quantity: string; persistedQuantity: string }
  | { type: 'REMOVE'; lineId: string }
  /** A persisted line replaced by another configuration; a reason makes it an audited correction. */
  | { type: 'REPLACE'; lineId: string; lines: Lines; reason?: string }
  /** The persisted Sale was reloaded: the same proposed changes now apply to its new version. */
  | { type: 'REBASE'; baseVersion: number };

export const emptyOrderAdjustmentDraft = (baseVersion: number): OrderAdjustmentDraft => ({
  baseVersion,
  operations: [],
});

const touchesLine = (operation: OrderAdjustmentOperation, lineId: string) =>
  operation.kind !== 'ADD' && operation.lineId === lineId;

/** The draft after one change, normalized: one operation per persisted line, one per addition. */
export function adjustOrderDraft(
  draft: OrderAdjustmentDraft,
  action: OrderAdjustmentDraftAction,
): OrderAdjustmentDraft {
  const others = (lineId: string) =>
    draft.operations.filter((operation) => !touchesLine(operation, lineId));
  switch (action.type) {
    case 'ADD':
      return {
        ...draft,
        operations: [
          ...draft.operations,
          { kind: 'ADD', clientKey: action.clientKey, lines: action.lines },
        ],
      };
    case 'EDIT_ADDED':
      return {
        ...draft,
        operations: draft.operations.map((operation) =>
          operation.kind === 'ADD' && operation.clientKey === action.clientKey
            ? { ...operation, lines: action.lines }
            : operation,
        ),
      };
    case 'REMOVE_ADDED':
      return {
        ...draft,
        operations: draft.operations.filter(
          (operation) => !(operation.kind === 'ADD' && operation.clientKey === action.clientKey),
        ),
      };
    case 'QUANTITY':
      return {
        ...draft,
        operations: createDecimal(action.quantity).equals(createDecimal(action.persistedQuantity))
          ? others(action.lineId)
          : [
              ...others(action.lineId),
              { kind: 'QUANTITY', lineId: action.lineId, quantity: action.quantity },
            ],
      };
    case 'REMOVE':
      return {
        ...draft,
        operations: [...others(action.lineId), { kind: 'REMOVE', lineId: action.lineId }],
      };
    case 'REPLACE':
      return {
        ...draft,
        operations: [
          ...others(action.lineId),
          {
            kind: 'REPLACE',
            lineId: action.lineId,
            lines: action.lines,
            ...(action.reason ? { reason: action.reason } : {}),
          },
        ],
      };
    case 'REBASE':
      return { ...draft, baseVersion: action.baseVersion };
  }
}

/** The operation a draft holds for a persisted line, if any. */
export function draftOperationFor(
  draft: OrderAdjustmentDraft,
  lineId: string,
): OrderAdjustmentOperation | undefined {
  return draft.operations.find((operation) => touchesLine(operation, lineId));
}

/** The draft as Runtime receives it for preview or save; null while nothing is proposed. */
export function orderAdjustmentInput(draft: OrderAdjustmentDraft): OrderAdjustmentInput | null {
  return draft.operations.length
    ? { expectedVersion: draft.baseVersion, operations: draft.operations }
    : null;
}
