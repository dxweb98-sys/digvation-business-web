import type {
  WorkshopLineAdjustmentEntry,
  WorkshopLineAdjustmentInput,
  WorkshopWorkOrderLine,
} from '../api/workshop-lines-api';
import {
  addToDraft,
  draftIssue,
  isValidQuantity,
  toSelectionInput,
  type DraftLine,
} from './work-order-lines-model';

/**
 * Browser-only staged changes to the effective Lines. Never authoritative:
 * Runtime re-validates every target and re-resolves every added item on save.
 */
export interface AdjustmentDraft {
  /** Edited quantity text by effective Line id. Absent means unchanged. */
  quantities: Readonly<Record<string, string>>;
  /** Effective Line ids staged for removal. */
  removed: readonly string[];
  added: readonly DraftLine[];
}

export const EMPTY_ADJUSTMENT_DRAFT: AdjustmentDraft = { quantities: {}, removed: [], added: [] };

const sameQuantity = (left: string, right: string) => Number(left) === Number(right);

export function draftQuantity(line: WorkshopWorkOrderLine, draft: AdjustmentDraft): string {
  return draft.quantities[line.id] ?? line.quantity;
}

export function setLineQuantity(
  draft: AdjustmentDraft,
  line: WorkshopWorkOrderLine,
  quantity: string,
): AdjustmentDraft {
  const rest = Object.fromEntries(
    Object.entries(draft.quantities).filter(([lineId]) => lineId !== line.id),
  );
  return {
    ...draft,
    quantities:
      isValidQuantity(quantity) && sameQuantity(quantity, line.quantity)
        ? rest
        : { ...rest, [line.id]: quantity },
  };
}

export function toggleLineRemoval(draft: AdjustmentDraft, lineId: string): AdjustmentDraft {
  return {
    ...draft,
    removed: draft.removed.includes(lineId)
      ? draft.removed.filter((id) => id !== lineId)
      : [...draft.removed, lineId],
  };
}

export function addDraftItems(
  draft: AdjustmentDraft,
  items: readonly DraftLine[],
): AdjustmentDraft {
  return { ...draft, added: items.reduce<DraftLine[]>(addToDraft, [...draft.added]) };
}

export function replaceAddedItem(
  draft: AdjustmentDraft,
  key: string,
  next: DraftLine | null,
): AdjustmentDraft {
  return {
    ...draft,
    added: draft.added.flatMap((line) => (line.key !== key ? [line] : next ? [next] : [])),
  };
}

/** Semantic changes, in Runtime's order: existing Lines first, then additions. */
export function buildAdjustmentInputs(
  lines: readonly WorkshopWorkOrderLine[],
  draft: AdjustmentDraft,
): WorkshopLineAdjustmentInput[] {
  const changes = lines.flatMap((line): WorkshopLineAdjustmentInput[] => {
    if (draft.removed.includes(line.id)) return [{ type: 'REMOVE', lineId: line.id }];
    const quantity = draft.quantities[line.id];
    return quantity !== undefined && !sameQuantity(quantity, line.quantity)
      ? [{ type: 'QUANTITY_CHANGE', lineId: line.id, quantity }]
      : [];
  });
  return [
    ...changes,
    ...toSelectionInput(draft.added).map((selection): WorkshopLineAdjustmentInput => ({
      type: 'ADD',
      ...selection,
    })),
  ];
}

/** Something changed, and no staged quantity or added item is invalid. */
export function adjustmentReady(
  lines: readonly WorkshopWorkOrderLine[],
  draft: AdjustmentDraft,
): boolean {
  const quantitiesValid = lines.every((line) => {
    const staged = draft.quantities[line.id];
    return draft.removed.includes(line.id) || staged === undefined || isValidQuantity(staged);
  });
  return (
    quantitiesValid &&
    draft.added.every((line) => draftIssue(line) === null) &&
    buildAdjustmentInputs(lines, draft).length > 0
  );
}

export function adjustmentCount(
  lines: readonly WorkshopWorkOrderLine[],
  draft: AdjustmentDraft,
): number {
  return buildAdjustmentInputs(lines, draft).length;
}

/** Newest change first; history is secondary and reads as "what happened last". */
export function historyNewestFirst(
  entries: readonly WorkshopLineAdjustmentEntry[],
): WorkshopLineAdjustmentEntry[] {
  return [...entries].sort((left, right) => right.sequence - left.sequence);
}
