/**
 * Point arithmetic for the manual adjustment preview. Points are NUMERIC(19,4) strings from
 * Runtime and are never converted to a JavaScript number: values are held as integers scaled by
 * 10^4. Runtime stays the authority; this only previews and spares an obviously invalid request.
 */
const FACTOR = BigInt(10_000);
const ZERO = BigInt(0);

export type AdjustmentDirection = 'ADD' | 'SUBTRACT';

/** Digits with one optional decimal separator (`.` or `,`), at most 4 decimal places. */
export function sanitizePointsInput(raw: string): string {
  const cleaned = raw.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  if (!rest.length) return whole;
  return `${whole}.${rest.join('').slice(0, 4)}`;
}

/** Scaled integer for a plain non-negative decimal string; null for anything else. */
export function parsePoints(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(value.trim());
  if (!match) return null;
  return BigInt(match[1]!) * FACTOR + BigInt((match[2] ?? '').padEnd(4, '0') || '0');
}

/** Canonical NUMERIC(19,4) string for a scaled value, e.g. `500.0000`. */
export function pointsToString(value: bigint): string {
  const negative = value < ZERO;
  const abs = negative ? -value : value;
  const whole = (abs / FACTOR).toString();
  const fraction = (abs % FACTOR).toString().padStart(4, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** A positive amount in the form Runtime accepts (`200`, `12.5`); null when blank, zero or malformed. */
export function adjustmentAmount(input: string): bigint | null {
  const value = parsePoints(input);
  return value !== null && value > ZERO ? value : null;
}

export interface AdjustmentPreview {
  current: string;
  /** Signed canonical delta. */
  adjustment: string;
  /** Canonical resulting balance (may be negative: the request is then blocked). */
  result: string;
  wouldBeNegative: boolean;
}

export function previewAdjustment(
  currentBalance: string,
  amountInput: string,
  direction: AdjustmentDirection,
): AdjustmentPreview | null {
  const current = parsePoints(currentBalance);
  const amount = adjustmentAmount(amountInput);
  if (current === null || amount === null) return null;
  const delta = direction === 'ADD' ? amount : -amount;
  const result = current + delta;
  return {
    current: pointsToString(current),
    adjustment: pointsToString(delta),
    result: pointsToString(result),
    wouldBeNegative: result < ZERO,
  };
}

/** Request amount exactly as typed, normalized (`0200` → `200`, `12.50` → `12.5`). */
export function adjustmentAmountForRequest(input: string): string | null {
  const value = adjustmentAmount(input);
  if (value === null) return null;
  const [whole, fraction] = pointsToString(value).split('.');
  const trimmed = (fraction ?? '').replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : (whole ?? '0');
}
