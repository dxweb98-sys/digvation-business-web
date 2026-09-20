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
  /** Recorded reason of a manual discount; never used as its title. */
  reason: string | null;
}

/** Title and optional supporting note shown for one discount, identical on every surface. */
export interface DiscountPresentationText {
  title: string;
  note: string | null;
}

function discountTitle(word: string, percentage: string | null): string {
  return percentage ? `${word} (${percentage}%)` : word;
}

function reasonNote(reason: string | null | undefined): string | null {
  const note = reason?.trim();
  return note ? note : null;
}

/**
 * A manual discount is titled by what it is ("Diskon (10%)" or "Diskon"); its
 * recorded reason is only supporting text. A promotion keeps its own name.
 */
export function discountPresentation(
  row: Pick<DiscountPresentationRow, 'source' | 'label' | 'percentage' | 'reason'>,
  discountWord: string,
): DiscountPresentationText {
  if (row.source === 'PROMOTION')
    return { title: discountTitle(row.label, row.percentage), note: null };
  return { title: discountTitle(discountWord, row.percentage), note: reasonNote(row.reason) };
}

/** The manual discount set on one sale line, presented like any other manual discount. */
export function lineDiscountPresentation(
  line: Pick<SaleLine, 'discountType' | 'discountValue' | 'discountReason'>,
  discountWord: string,
): DiscountPresentationText {
  return {
    title: discountTitle(discountWord, lineDiscountPercentage(line)),
    note: reasonNote(line.discountReason),
  };
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

/** One discount applied to a sale line, ready to render with its amount. */
export interface LineDiscountRow extends DiscountPresentationText {
  id: string;
  amount: string;
}

/**
 * Discounts on one line from the Runtime adjustments, so a promotion keeps its
 * name and a manual discount reads "Diskon" with its reason as the note.
 */
export function lineDiscountRows(
  sale: Pick<Sale, 'adjustments'>,
  line: Pick<
    SaleLine,
    'id' | 'lineDiscountAmount' | 'discountType' | 'discountValue' | 'discountReason'
  >,
  discountWord: string,
): LineDiscountRow[] {
  const rows = (sale.adjustments ?? [])
    .filter((adjustment) => adjustment.saleLineId === line.id && positive(adjustment.actualAmount))
    .map((adjustment) => ({
      id: adjustment.id,
      amount: adjustment.actualAmount,
      ...discountPresentation(
        {
          source: adjustment.source,
          label: adjustment.label || 'Promo',
          percentage:
            adjustment.type === 'PERCENTAGE'
              ? percentageFromRate(adjustment.configuredValue)
              : null,
          reason: adjustment.source === 'MANUAL_DISCOUNT' ? adjustment.reason : null,
        },
        discountWord,
      ),
    }));
  if (rows.length || !positive(line.lineDiscountAmount)) return rows;
  return [
    {
      id: `${line.id}-discount`,
      amount: line.lineDiscountAmount,
      ...lineDiscountPresentation(line, discountWord),
    },
  ];
}

/**
 * Automatic item promotions are explained on the affected line; they are not
 * repeated in the checkout-level Promo & diskon card. Code promotions remain
 * visible there because the cashier explicitly applied the code.
 */
export function checkoutAdjustmentRows(
  sale: Pick<Sale, 'adjustments' | 'promotionCode'>,
): SaleAdjustment[] {
  return (sale.adjustments ?? []).filter(
    (adjustment) =>
      positive(adjustment.actualAmount) &&
      !(adjustment.source === 'PROMOTION' && adjustment.scope === 'ITEM' && !sale.promotionCode),
  );
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
        adjustment.type === 'PERCENTAGE' ? percentageFromRate(adjustment.configuredValue) : null,
      reason: adjustment.source === 'MANUAL_DISCOUNT' ? adjustment.reason : null,
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
      reason: sale.orderDiscountReason,
    });
  }

  return rows;
}

export function transactionDiscountPercentage(sale: DiscountPresentationSale): string | null {
  const rows = saleDiscountRows(sale);
  const transactionRows = rows.filter((row) => row.scope === 'TRANSACTION');
  return rows.length === 1 && transactionRows.length === 1
    ? (transactionRows[0]?.percentage ?? null)
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

type ProgressPayment = Pick<Payment, 'status' | 'appliedAmount'>;

export interface AppliedPaymentComposition<P> {
  /** Payments that actually settle the sale, in the order they were taken. */
  components: P[];
  totalPaid: string;
  /** Every applied payment together covers the total and nothing is still waiting. */
  settled: boolean;
  /** More than one applied payment settled the sale. Failed or cancelled attempts never count. */
  isSplit: boolean;
}

/**
 * How a sale was actually paid. Mirrors Runtime settlement, which only counts succeeded
 * payments; the number of payment records or methods tried says nothing on its own.
 */
export function appliedPaymentComposition<
  P extends ProgressPayment & { createdAt?: string },
>(sale: { totalAmount: string; payments: readonly P[] }): AppliedPaymentComposition<P> {
  const components = sale.payments
    .filter(
      (payment) =>
        payment.status === 'SUCCEEDED' &&
        createDecimal(String(payment.appliedAmount)).greaterThan(0),
    )
    .sort((left, right) => (left.createdAt ?? '').localeCompare(right.createdAt ?? ''));
  const totalPaid = components.reduce(
    (sum, payment) => sum.plus(createDecimal(String(payment.appliedAmount))),
    createDecimal('0'),
  );
  const settled =
    !sale.payments.some((payment) => payment.status === 'PENDING') &&
    totalPaid.greaterThanOrEqualTo(createDecimal(String(sale.totalAmount)));
  return {
    components,
    totalPaid: totalPaid.toFixed(4),
    settled,
    isSplit: settled && components.length > 1,
  };
}

export interface PaymentProgress {
  /** Payments Runtime reports as succeeded. */
  paidAmount: string;
  /** Payments Runtime has accepted but that still wait for confirmation. */
  pendingAmount: string;
  /** What is still open for a new payment. */
  remainingAmount: string;
}

/** Presentation projection of Runtime payment state for an open checkout. */
export function paymentProgress(sale: {
  totalAmount: string;
  payments: readonly ProgressPayment[];
}): PaymentProgress {
  const sum = (status: Payment['status']) =>
    sale.payments
      .filter((payment) => payment.status === status)
      .reduce(
        (total, payment) => total.plus(createDecimal(String(payment.appliedAmount))),
        createDecimal('0'),
      );
  const paid = sum('SUCCEEDED');
  const pending = sum('PENDING');
  const remaining = createDecimal(String(sale.totalAmount)).minus(paid).minus(pending);
  return {
    paidAmount: paid.toFixed(4),
    pendingAmount: pending.toFixed(4),
    remainingAmount: remaining.greaterThan(0) ? remaining.toFixed(4) : '0.0000',
  };
}

export type PaymentIntentOutcome = 'COMPLETES' | 'LEAVES_BALANCE';

export interface PaymentIntent extends PaymentProgress {
  amount: string;
  remainingAfter: string;
  outcome: PaymentIntentOutcome;
  /** The transaction is, or will be, settled by more than one payment. */
  isSplit: boolean;
}

/**
 * Describes what the payment being prepared will do before it is sent. Runtime still decides
 * whether the payment is accepted and whether the transaction is settled.
 */
export function paymentIntent(
  sale: { totalAmount: string; payments: readonly ProgressPayment[] },
  amount: string,
): PaymentIntent {
  const progress = paymentProgress(sale);
  const applied = createDecimal(amount || '0');
  const after = createDecimal(progress.remainingAmount).minus(applied);
  const hasEarlierPayment =
    createDecimal(progress.paidAmount).greaterThan(0) ||
    createDecimal(progress.pendingAmount).greaterThan(0);
  const settlesBalance = after.lessThanOrEqualTo(0);
  return {
    ...progress,
    amount: applied.toFixed(4),
    remainingAfter: settlesBalance ? '0.0000' : after.toFixed(4),
    outcome: settlesBalance ? 'COMPLETES' : 'LEAVES_BALANCE',
    isSplit: hasEarlierPayment || !settlesBalance,
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
