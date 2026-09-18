import { createDecimal } from '@digvation/pos-money';

import type {
  Employee,
  Payment,
  Sale,
  SaleAdjustment,
  SaleLine,
  TaxTreatment,
} from './cashier-transaction.types';

export interface DiscountPresentationRow {
  id: string;
  source: SaleAdjustment['source'];
  scope: SaleAdjustment['scope'];
  saleLineId: string | null;
  label: string;
  amount: string;
  percentage: string | null;
}

type DiscountPresentationSale = Pick<
  Sale,
  | 'adjustments'
  | 'orderDiscountType'
  | 'orderDiscountValue'
  | 'orderDiscountAmount'
  | 'orderDiscountReason'
>;

type TaxPresentationLine = Pick<
  SaleLine,
  'removedAt' | 'itemTaxAmount' | 'itemTaxRate' | 'itemTaxTreatment'
>;

type TaxPresentationSale = Pick<
  Sale,
  'transactionTaxAmount' | 'transactionTaxRate' | 'transactionTaxTreatment'
> & {
  lines: readonly TaxPresentationLine[];
};

function positive(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return createDecimal(value).greaterThan(0);
  } catch {
    return false;
  }
}

export function percentageFromRate(rate: string | null | undefined): string | null {
  if (!rate) return null;
  try {
    return createDecimal(rate)
      .times(100)
      .toFixed(4)
      .replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  } catch {
    return null;
  }
}

export function lineBaseUnitPrice(line: Pick<SaleLine, 'effectiveUnitPrice'>): string {
  return line.effectiveUnitPrice;
}

export function lineBaseSubtotal(line: Pick<SaleLine, 'grossAmount'>): string {
  return line.grossAmount;
}

export function lineDiscountPercentage(
  line: Pick<SaleLine, 'discountType' | 'discountValue'>,
): string | null {
  return line.discountType === 'PERCENTAGE' ? percentageFromRate(line.discountValue) : null;
}

export function saleDiscountRows(sale: DiscountPresentationSale): DiscountPresentationRow[] {
  const rows = (sale.adjustments ?? [])
    .filter((adjustment) => positive(adjustment.actualAmount))
    .map((adjustment) => ({
      id: adjustment.id,
      source: adjustment.source,
      scope: adjustment.scope,
      saleLineId: adjustment.saleLineId,
      label:
        adjustment.source === 'PROMOTION'
          ? adjustment.label || 'Promo'
          : adjustment.label || 'Diskon manual',
      amount: adjustment.actualAmount,
      percentage:
        adjustment.type === 'PERCENTAGE'
          ? percentageFromRate(adjustment.configuredValue)
          : null,
    }));

  const hasManualTransactionRow = rows.some(
    (row) => row.source === 'MANUAL_DISCOUNT' && row.scope === 'TRANSACTION',
  );
  if (
    !hasManualTransactionRow &&
    positive(sale.orderDiscountAmount) &&
    sale.orderDiscountType &&
    sale.orderDiscountValue
  ) {
    rows.push({
      id: 'order-discount',
      source: 'MANUAL_DISCOUNT',
      scope: 'TRANSACTION',
      saleLineId: null,
      label: sale.orderDiscountReason || 'Diskon manual',
      amount: sale.orderDiscountAmount,
      percentage:
        sale.orderDiscountType === 'PERCENTAGE'
          ? percentageFromRate(sale.orderDiscountValue)
          : null,
    });
  }

  return rows;
}

export function transactionDiscountPercentage(sale: DiscountPresentationSale): string | null {
  const rows = saleDiscountRows(sale);
  const transactionRows = rows.filter((row) => row.scope === 'TRANSACTION');
  return rows.length === 1 && transactionRows.length === 1
    ? transactionRows[0]?.percentage ?? null
    : null;
}

export function saleTaxPercentage(sale: TaxPresentationSale): string | null {
  const percentages = new Set<string>();
  let hasUnknownPositiveRate = false;

  if (positive(sale.transactionTaxAmount)) {
    const percentage = percentageFromRate(sale.transactionTaxRate);
    if (percentage) percentages.add(percentage);
    else hasUnknownPositiveRate = true;
  }

  for (const line of sale.lines) {
    if (line.removedAt !== null || !positive(line.itemTaxAmount)) continue;
    const percentage = percentageFromRate(line.itemTaxRate);
    if (percentage) percentages.add(percentage);
    else hasUnknownPositiveRate = true;
  }

  if (hasUnknownPositiveRate || percentages.size !== 1) return null;
  return [...percentages][0] ?? null;
}

export function saleTaxTreatment(sale: TaxPresentationSale): TaxTreatment | null {
  const treatments = new Set<TaxTreatment>();
  let hasUnknownPositiveTreatment = false;

  if (positive(sale.transactionTaxAmount)) {
    if (sale.transactionTaxTreatment) treatments.add(sale.transactionTaxTreatment);
    else hasUnknownPositiveTreatment = true;
  }

  for (const line of sale.lines) {
    if (line.removedAt !== null || !positive(line.itemTaxAmount)) continue;
    if (line.itemTaxTreatment) treatments.add(line.itemTaxTreatment);
    else hasUnknownPositiveTreatment = true;
  }

  if (hasUnknownPositiveTreatment || treatments.size !== 1) return null;
  return [...treatments][0] ?? null;
}

export function saleTaxLabel(
  sale: TaxPresentationSale,
  baseLabel = 'Pajak',
  includedLabel = baseLabel === 'Tax' ? 'Tax included' : 'Pajak termasuk',
): string {
  const label = saleTaxTreatment(sale) === 'INCLUDED' ? includedLabel : baseLabel;
  const percentage = saleTaxPercentage(sale);
  return percentage ? `${label} (${percentage}%)` : label;
}

export function transactionDiscountLabel(
  sale: DiscountPresentationSale,
  baseLabel = 'Promo dan diskon',
): string {
  const percentage = transactionDiscountPercentage(sale);
  return percentage ? `${baseLabel} (${percentage}%)` : baseLabel;
}

export function employeeDisplayName(
  line: Pick<SaleLine, 'contributions'>,
  employeeId: string,
  employees: readonly Pick<Employee, 'id' | 'displayName'>[],
  unavailableLabel = 'Karyawan tidak tersedia',
): string {
  const snapshot = line.contributions.find(
    (contribution) => contribution.employeeId === employeeId,
  )?.employeeDisplayNameSnapshot;
  if (snapshot?.trim()) return snapshot;
  const current = employees.find((employee) => employee.id === employeeId)?.displayName;
  return current?.trim() || unavailableLabel;
}

type SettlementPayment = Pick<
  Payment,
  'status' | 'method' | 'appliedAmount' | 'tenderedAmount' | 'changeAmount'
>;

export interface SaleSettlement {
  totalPaid: string;
  balanceDue: string;
  cashTendered: string | null;
  cashChange: string | null;
  paymentState: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
}

/**
 * Presentation projection of recorded payments against the authoritative Sale total. It only
 * sums succeeded payment amounts returned by Runtime; no pricing, tax, or discount rule is applied.
 */
export function saleSettlement(sale: {
  totalAmount: string;
  payments: readonly SettlementPayment[];
}): SaleSettlement {
  const succeeded = sale.payments.filter((payment) => payment.status === 'SUCCEEDED');
  const totalPaid = succeeded.reduce(
    (sum, payment) => sum.plus(createDecimal(String(payment.appliedAmount))),
    createDecimal('0'),
  );
  const balance = createDecimal(String(sale.totalAmount)).minus(totalPaid);
  const cash = succeeded.filter((payment) => payment.method === 'CASH');
  const cashTendered = cash
    .filter((payment) => payment.tenderedAmount !== null)
    .reduce(
      (sum, payment) => sum.plus(createDecimal(String(payment.tenderedAmount))),
      createDecimal('0'),
    );
  const cashChange = cash.reduce(
    (sum, payment) => sum.plus(createDecimal(String(payment.changeAmount ?? '0'))),
    createDecimal('0'),
  );
  const hasPending = sale.payments.some((payment) => payment.status === 'PENDING');
  const settled = !hasPending && totalPaid.equals(createDecimal(String(sale.totalAmount)));

  return {
    totalPaid: totalPaid.toFixed(4),
    balanceDue: balance.greaterThan(0) ? balance.toFixed(4) : '0.0000',
    cashTendered: cash.some((payment) => payment.tenderedAmount !== null)
      ? cashTendered.toFixed(4)
      : null,
    cashChange: cashChange.greaterThan(0) ? cashChange.toFixed(4) : null,
    paymentState: settled ? 'PAID' : totalPaid.greaterThan(0) ? 'PARTIALLY_PAID' : 'UNPAID',
  };
}

/** Presents an authoritative service duration in whole hours and minutes. */
export function formatServiceDuration(
  minutes: number | null | undefined,
  labels: { hour: string; minute: string },
): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} ${labels.minute}`;
  return rest === 0
    ? `${hours} ${labels.hour}`
    : `${hours} ${labels.hour} ${rest} ${labels.minute}`;
}
