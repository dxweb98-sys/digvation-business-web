import { createDecimal } from './money';

/**
 * The one payment-correction composition model, shared by Operational and Backoffice.
 *
 * Payment correction means "the payment was recorded wrongly", never "money was moved": the
 * operator states the CORRECT composition per payment route, and the signed moves are derived from
 * the target minus what Runtime currently holds. The total paid is fixed and authoritative, so a
 * valid draft always nets to zero. Runtime validates the final command again.
 *
 * Amounts are plain decimal strings ("195350", "10000.5"); an empty string means zero while typing.
 */
export interface CorrectionRouteInfo {
  routeId: string;
  /** The financial account / route name shown to the operator. */
  name: string;
  /** The payment method, shown underneath; two BANK_TRANSFER routes stay distinct targets. */
  method: string;
}

export interface CorrectionEffectiveEntry {
  routeId: string;
  /** What Runtime effectively holds on the route now (after payments, refunds, corrections). */
  amount: string;
}

export interface CorrectionDraft {
  /** The fixed, authoritative total paid on route-bound payments. */
  total: string;
  /** Every route's current effective amount; routes absent here hold nothing. */
  current: Readonly<Record<string, string>>;
  /** The routes of the target composition, in display order. */
  selected: readonly string[];
  /** The typed target amount of each selected route. */
  amounts: Readonly<Record<string, string>>;
}

const ZERO = '0';

function valueOf(text: string | undefined): ReturnType<typeof createDecimal> | null {
  const trimmed = (text ?? '').trim();
  if (trimmed === '') return createDecimal(ZERO);
  return /^\d+(\.\d{1,4})?$/.test(trimmed) ? createDecimal(trimmed) : null;
}

/** A canonical plain decimal ("195350", "10000.5"): never a trailing-zero Runtime string. */
const plain = (value: ReturnType<typeof createDecimal>) =>
  value.toFixed(4).replace(/\.?0+$/, '') || ZERO;

/**
 * Starts from what Runtime holds now. Only routes with a non-zero effective amount are selected;
 * every other route is available to add and is hidden until then.
 */
export function startCorrectionDraft(
  entries: readonly CorrectionEffectiveEntry[],
): CorrectionDraft {
  // Identity is the payment route, never the method: two entries of one route are one route, two
  // routes of one method stay two. The target starts as an exact copy of what is held now.
  const held = new Map<string, ReturnType<typeof createDecimal>>();
  for (const entry of entries)
    held.set(entry.routeId, (held.get(entry.routeId) ?? createDecimal(ZERO)).plus(entry.amount));
  const current: Record<string, string> = {};
  let total = createDecimal(ZERO);
  for (const [routeId, amount] of held) {
    current[routeId] = plain(amount);
    total = total.plus(amount);
  }
  const selected = [...held].filter(([, amount]) => !amount.isZero()).map(([routeId]) => routeId);
  return {
    total: plain(total),
    current,
    selected,
    amounts: Object.fromEntries(selected.map((routeId) => [routeId, current[routeId]!])),
  };
}

/** The routes that can still be added: any known route not already in the target composition. */
export function addableRoutes<T extends { routeId: string }>(
  draft: CorrectionDraft,
  routes: readonly T[],
): T[] {
  const taken = new Set(draft.selected);
  return routes.filter((route) => !taken.has(route.routeId));
}

/** Adds a route to the target composition with nothing allocated to it yet. Never twice. */
export function addCorrectionRoute(draft: CorrectionDraft, routeId: string): CorrectionDraft {
  if (draft.selected.includes(routeId)) return draft;
  return {
    ...draft,
    selected: [...draft.selected, routeId],
    amounts: { ...draft.amounts, [routeId]: ZERO },
  };
}

/** A route can be removed only while another remains: the composition never becomes empty. */
export function canRemoveCorrectionRoute(draft: CorrectionDraft): boolean {
  return draft.selected.length > 1;
}

/**
 * Removing a route sets its target to zero; the original payment fact is untouched. When exactly
 * one route remains it receives the balancing amount. With several left, nothing is guessed.
 */
export function removeCorrectionRoute(draft: CorrectionDraft, routeId: string): CorrectionDraft {
  if (!draft.selected.includes(routeId) || !canRemoveCorrectionRoute(draft)) return draft;
  const selected = draft.selected.filter((candidate) => candidate !== routeId);
  const amounts = Object.fromEntries(
    selected.map((candidate) => [candidate, draft.amounts[candidate] ?? ZERO]),
  );
  if (selected.length === 1) amounts[selected[0]!] = draft.total;
  return { ...draft, selected, amounts };
}

/**
 * Edits one target amount. With EXACTLY two selected routes the other one balances automatically so
 * the target total stays the fixed total paid. With three or more nothing else changes: the
 * unallocated amount is shown instead.
 */
export function editCorrectionAmount(
  draft: CorrectionDraft,
  routeId: string,
  text: string,
): CorrectionDraft {
  if (!draft.selected.includes(routeId)) return draft;
  const amounts: Record<string, string> = { ...draft.amounts, [routeId]: text };
  if (draft.selected.length === 2) {
    const other = draft.selected.find((candidate) => candidate !== routeId)!;
    const typed = valueOf(text);
    if (typed) {
      const balance = createDecimal(draft.total).minus(typed);
      amounts[other] = balance.isNegative() ? ZERO : plain(balance);
    }
  }
  return { ...draft, amounts };
}

/** Total − Σ target. Positive: still to allocate. Negative: allocated beyond the total paid. */
export function unallocatedAmount(draft: CorrectionDraft): string {
  let sum = createDecimal(ZERO);
  for (const routeId of draft.selected) sum = sum.plus(valueOf(draft.amounts[routeId]) ?? ZERO);
  return plain(createDecimal(draft.total).minus(sum));
}

export interface CorrectionMove {
  routeId: string;
  /** Signed, plain decimal: negative takes the recording away from the route, positive gives it. */
  delta: string;
}

/** target − current for every route whose recording changes; removed routes target zero. */
export function correctionMoves(draft: CorrectionDraft): CorrectionMove[] {
  const routeIds = [...new Set([...Object.keys(draft.current), ...draft.selected])];
  const moves: CorrectionMove[] = [];
  for (const routeId of routeIds) {
    const target = draft.selected.includes(routeId)
      ? (valueOf(draft.amounts[routeId]) ?? createDecimal(ZERO))
      : createDecimal(ZERO);
    const delta = target.minus(createDecimal(draft.current[routeId] ?? ZERO));
    if (!delta.isZero()) moves.push({ routeId, delta: plain(delta) });
  }
  return moves;
}

export type CorrectionDraftState =
  | { ok: true; moves: CorrectionMove[] }
  | {
      ok: false;
      reason: 'INVALID_AMOUNT' | 'UNALLOCATED' | 'NO_CHANGE';
      /** Still to allocate (positive) or allocated beyond the total (negative). */
      unallocated: string;
    };

/** The draft is saveable only when the target differs, every amount is valid and the total matches. */
export function correctionDraftState(draft: CorrectionDraft): CorrectionDraftState {
  const unallocated = unallocatedAmount(draft);
  if (draft.selected.some((routeId) => valueOf(draft.amounts[routeId]) === null))
    return { ok: false, reason: 'INVALID_AMOUNT', unallocated };
  if (!createDecimal(unallocated).isZero())
    return { ok: false, reason: 'UNALLOCATED', unallocated };
  const moves = correctionMoves(draft);
  if (moves.length === 0) return { ok: false, reason: 'NO_CHANGE', unallocated };
  return { ok: true, moves };
}

/** The Runtime request body: identical for the same current and target on every surface. */
export function paymentCorrectionRequest(input: {
  expectedVersion: number;
  reason: string;
  moves: readonly CorrectionMove[];
}) {
  return {
    expectedVersion: input.expectedVersion,
    reason: input.reason.trim(),
    moves: input.moves.map((move) => ({ paymentRouteId: move.routeId, delta: move.delta })),
  };
}

/** The sum of the derived deltas; zero for every saveable draft. */
export function correctionNet(moves: readonly CorrectionMove[]): string {
  return plain(
    moves.reduce((sum, move) => sum.plus(createDecimal(move.delta)), createDecimal(ZERO)),
  );
}
