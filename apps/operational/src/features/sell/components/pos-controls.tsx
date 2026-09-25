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

/**
 * Converts a canonical Runtime decimal amount into the whole-IDR domain value
 * used by the payment form. Runtime uses decimal strings (for example
 * `105224.0000`); the currency control must never parse that as an Indonesian
 * formatted display value.
 */
export function currencyInputFromAmount(value: string, fractionDigits = 0) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) throw new Error('Amount must be a canonical decimal string.');

  const sign = match[1] ?? '';
  const whole = match[2] ?? '0';
  const fraction = match[3] ?? '';
  if (fractionDigits === 0 && fraction && !/^0+$/.test(fraction)) {
    throw new Error('Whole-currency payment amounts cannot contain fractional units.');
  }

  const normalizedWhole = whole.replace(/^0+(?=\d)/, '') || '0';
  return fractionDigits === 0 || !fraction
    ? `${sign}${normalizedWhole}`
    : `${sign}${normalizedWhole}.${fraction}`;
}

/** Converts the CurrencyInput's parsed value into the payment command value. */
export function normalizeCurrencyPaymentInput(value: string, fractionDigits = 0) {
  if (!value) return '';
  return normalizeDecimalInput(value, { integer: fractionDigits === 0 });
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
  const normalizedValue = normalizeCurrencyPaymentInput(value, fractionDigits);
  return (
    <DCurrencyInput
      {...props}
      value={normalizedValue}
      onValueChange={(nextValue) =>
        onChange(normalizeCurrencyPaymentInput(nextValue, fractionDigits))
      }
      className={`${className} tabular-nums`}
    />
  );
}
