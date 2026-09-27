import {
  DCurrencyInput,
  DDecimalInput,
  normalizeDecimalInput,
  type CurrencyInputProps,
  type DecimalInputProps,
} from '@digvation-labs/ui';
import { useState, type ReactNode } from 'react';

function plainNumeric(value: string) {
  if (!value) return '';
  const [whole, fraction] = value.split('.');
  const normalizedWhole = (whole || '0').replace(/^0+(?=\d)/, '');
  return fraction === undefined ? normalizedWhole : `${normalizedWhole}.${fraction}`;
}

function compareDecimalText(left: string, right: string): number {
  const [leftWhole = '0', leftFraction = ''] = left.split('.');
  const [rightWhole = '0', rightFraction = ''] = right.split('.');
  const normalizedLeftWhole = leftWhole.replace(/^0+(?=\d)/, '') || '0';
  const normalizedRightWhole = rightWhole.replace(/^0+(?=\d)/, '') || '0';
  if (normalizedLeftWhole.length !== normalizedRightWhole.length) {
    return normalizedLeftWhole.length - normalizedRightWhole.length;
  }
  if (normalizedLeftWhole !== normalizedRightWhole) {
    return normalizedLeftWhole < normalizedRightWhole ? -1 : 1;
  }
  const length = Math.max(leftFraction.length, rightFraction.length);
  const normalizedLeftFraction = leftFraction.padEnd(length, '0');
  const normalizedRightFraction = rightFraction.padEnd(length, '0');
  return normalizedLeftFraction === normalizedRightFraction
    ? 0
    : normalizedLeftFraction < normalizedRightFraction
      ? -1
      : 1;
}

function clampNumericText(value: string, min: string, max: string | undefined, integer: boolean) {
  const normalized = normalizeDecimalInput(value, { integer });
  if (!normalized || normalized === '0.') return normalized;
  if (compareDecimalText(normalized, min) < 0) return min;
  if (max !== undefined && compareDecimalText(normalized, max) > 0) return max;
  return normalized;
}

const CANONICAL_AMOUNT = /^(-?)(\d+)(?:\.(\d+))?$/;

/**
 * Meaningful fraction digits of a canonical Runtime decimal: `105224.0000` has none,
 * `328171.5000` has one. Runtime decimals carry up to four digits; only a non-zero
 * fraction is meaningful. Anything that is not a canonical decimal reports none.
 */
export function amountFractionDigits(value: string): number {
  const match = CANONICAL_AMOUNT.exec(value.trim());
  return match ? (match[3] ?? '').replace(/0+$/, '').length : 0;
}

/**
 * Converts a canonical Runtime decimal amount into the exact domain value used by the
 * payment form. The value is never rounded, scaled or reinterpreted: `105224.0000`
 * becomes `105224`, `328171.5000` becomes `328171.5`. Runtime uses `.` as its decimal
 * point, so this must never treat it as a display thousands separator.
 *
 * Text that is not a canonical decimal yields no amount (empty) rather than a guess, so
 * the payment stays disabled instead of charging a different value.
 */
export function currencyInputFromAmount(value: string): string {
  const match = CANONICAL_AMOUNT.exec(value.trim());
  if (!match) return '';
  const sign = match[1] ?? '';
  const whole = (match[2] ?? '0').replace(/^0+(?=\d)/, '');
  const fraction = (match[3] ?? '').replace(/0+$/, '');
  if (whole === '0' && !fraction) return '0';
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

function normalizeAmountText(value: string, fractionDigits: number, keepTypingSeparator: boolean) {
  const match = /^(\d*)(\.(\d*))?$/.exec(value.trim());
  // Formatted or otherwise unrecognised text never becomes another amount.
  if (!match) return '';
  const whole = (match[1] ?? '').replace(/^0+(?=\d)/, '');
  if (fractionDigits <= 0 || match[2] === undefined) return whole;
  const fraction = (match[3] ?? '').slice(0, fractionDigits);
  if (!fraction && !keepTypingSeparator) return whole || '0';
  return `${whole || '0'}.${fraction}`;
}

/**
 * Normalizes a domain amount (canonical `.` decimal) into the payment command value.
 * Up to `fractionDigits` fraction digits are preserved exactly; nothing is rounded.
 */
export function normalizeCurrencyPaymentInput(value: string, fractionDigits = 4) {
  if (!value) return '';
  return normalizeAmountText(value, fractionDigits, false);
}

/** Feature-owned numeric constraint handling composed from canonical DecimalInput. */
export function PosNumericInput({
  value,
  onChange,
  min = '0',
  max,
  integer = false,
  suffix,
  className = '',
  ...props
}: Omit<DecimalInputProps, 'integer' | 'onValueChange' | 'value'> & {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  integer?: boolean;
  suffix?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const display = editing ? draft : plainNumeric(value);

  return (
    <div className="relative">
      <DDecimalInput
        {...props}
        value={display}
        className={`${className} ${suffix ? 'pr-8' : ''}`}
        integer={integer}
        onFocus={(event) => {
          setDraft(value);
          setEditing(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setEditing(false);
          const normalized = clampNumericText(draft, min, max, integer);
          setDraft(normalized);
          if (normalized) onChange(normalized);
          props.onBlur?.(event);
        }}
        onValueChange={(nextValue) => {
          setDraft(nextValue);
          onChange(nextValue);
        }}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--color-text-muted)]">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

/** Feature-owned payment amount field composed from canonical CurrencyInput. */
export function PosCurrencyInput({
  value,
  onChange,
  className = '',
  fractionDigits = 0,
  ...props
}: Omit<CurrencyInputProps, 'onValueChange' | 'value'> & {
  value: string;
  onChange: (value: string) => void;
  fractionDigits?: number;
}) {
  const normalizedValue = value ? normalizeAmountText(value, fractionDigits, true) : '';
  return (
    <DCurrencyInput
      {...props}
      value={normalizedValue}
      onValueChange={(nextValue) =>
        onChange(nextValue ? normalizeAmountText(nextValue, fractionDigits, true) : '')
      }
      className={`${className} tabular-nums`}
    />
  );
}
