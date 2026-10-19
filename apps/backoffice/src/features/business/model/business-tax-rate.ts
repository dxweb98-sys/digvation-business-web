/** Runtime stores the rate as a fraction ("0.11"); people read and type a percentage ("11"). */
export function percentageFromTaxRate(rate: string): string {
  const [whole = '0', fraction = ''] = rate.trim().split('.');
  if (whole === '1') return '100';
  const padded = fraction.padEnd(2, '0');
  const integer = padded.slice(0, 2).replace(/^0+(?=\d)/, '') || '0';
  const decimal = padded.slice(2).replace(/0+$/, '');
  return decimal ? `${integer}.${decimal}` : integer;
}

export function taxRateFromPercentage(value: string): string {
  const [rawWhole = '0', fraction = ''] = value.trim().split('.');
  const whole = rawWhole.replace(/^0+(?=\d)/, '') || '0';
  if (whole === '100') return '1';
  const digits = `${whole.padStart(2, '0')}${fraction}`.replace(/0+$/, '');
  return digits ? `0.${digits}` : '0';
}

export function isValidTaxPercentage(value: string): boolean {
  const percent = Number(value);
  return value.trim().length > 0 && Number.isFinite(percent) && percent >= 0 && percent <= 100;
}
