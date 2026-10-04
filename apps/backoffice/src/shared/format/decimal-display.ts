/**
 * Displays an exact Runtime decimal string (e.g. a quantity `1.5000`) without insignificant
 * scale, using the locale's grouping and decimal separators. Works on the string itself, so no
 * value ever passes through floating point. Not for money: use the localized money formatter.
 */
export function formatDecimalDisplay(value: string, locale: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return value;
  const [, sign = '', whole = '0', fraction = ''] = match;
  const significant = fraction.replace(/0+$/, '');
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(whole));
  const decimalSeparator =
    new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')
      ?.value ?? '.';
  const negative = sign && (/[1-9]/.test(whole) || significant) ? '-' : '';
  return `${negative}${grouped}${significant ? `${decimalSeparator}${significant}` : ''}`;
}
