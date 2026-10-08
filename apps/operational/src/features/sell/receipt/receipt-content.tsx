import { createDecimal } from '@digvation/pos-money';
import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { saleLineAdditions, saleLineBase } from '../transaction/model/sale-line-additions';
import {
  appliedPaymentComposition,
  saleDiscountRows,
  aggregateDiscountRows,
  lineTaxLabel,
  cashTenderNote,
  discountPresentation,
  lineDiscountRows,
  saleSettlement,
  saleTaxLabel,
} from '../transaction/model/sale-presentation';
import type { Sale, SaleCustomer, SaleLine } from '../transaction/model/cashier-transaction.types';
import { paymentAccountLabel } from '../payment/sale-payment-status';
import { paymentCompositionOf } from '../payment/payment-correction-draft';
import {
  money,
  quantity,
  transactionNumber,
  isPositiveDecimal,
} from '../transaction/model/sale-display';
import {
  customerDisplayName,
  customerDisplayDetail,
} from '../customer/model/sale-customer-display';
import { pointQuantity, receiptPointSummary } from '../transaction/model/sale-points';

export function ReceiptContent({
  sale,
  activeLines,
  customer,
  locale,
  businessName,
  branchName,
  branchAddress = null,
  cashierName,
  transactionDate,
  hasDiscount,
  hasTax,
}: {
  sale: Sale;
  activeLines: readonly SaleLine[];
  customer: SaleCustomer | null;
  locale: string;
  businessName: string;
  branchName: string;
  branchAddress?: string | null;
  cashierName: string;
  transactionDate: string;
  hasDiscount: boolean;
  hasTax: boolean;
}) {
  const { copy, label } = useOperationalLocalization();
  const discountRows = aggregateDiscountRows(saleDiscountRows(sale));
  const composition = appliedPaymentComposition(sale);
  // After a payment correction the customer-facing receipt shows what each route effectively
  // received, never the original recording; correction audit details stay out of the receipt.
  const corrected = (sale.paymentCorrections?.length ?? 0) > 0;
  const paymentLines = corrected
    ? paymentCompositionOf(sale)
        .entries.filter((entry) => createDecimal(entry.receivedAmount).greaterThan(0))
        .map((entry, index) => ({
          id: entry.paymentRouteId ?? `${entry.method}-${index}`,
          label: entry.financialAccountName?.trim() || label(entry.method),
          reference:
            composition.components
              .filter((payment) => payment.financePaymentRouteId === entry.paymentRouteId)
              .map((payment) => payment.providerReference)
              .filter(Boolean)
              .at(-1) ?? null,
          amount: entry.receivedAmount,
        }))
    : composition.components.map((payment) => ({
        id: payment.id,
        label: paymentAccountLabel(payment, (method) => label(method)),
        reference: payment.providerReference,
        amount: payment.appliedAmount,
      }));
  const paymentsSplit = corrected ? paymentLines.length > 1 : composition.isSplit;
  const paymentsTotal = corrected
    ? paymentLines
        .reduce((sum, line) => sum.plus(createDecimal(line.amount)), createDecimal('0'))
        .toFixed(4)
    : composition.totalPaid;
  const settlement = saleSettlement(sale);
  const legacyLoyaltyRedemption = sale.loyaltyRedemption as
    | (NonNullable<Sale['loyaltyRedemption']> & {
        requestedPoints?: string;
        redemptionAmount?: string;
      })
    | null
    | undefined;
  const redeemedPoints =
    sale.loyaltyRedemption?.points ?? legacyLoyaltyRedemption?.requestedPoints ?? null;
  const redeemedAmount =
    sale.loyaltyRedemption?.amount ?? legacyLoyaltyRedemption?.redemptionAmount ?? null;
  const hasLoyaltyRedemption = Boolean(redeemedPoints && redeemedAmount);
  // The transaction's point summary, stated once. Runtime's finalized loyalty summary is the single
  // authority; a Sale without one (earlier history) falls back to its finalized earning alone.
  const receiptPoints = receiptPointSummary(sale, customer);
  return (
    <>
      <header className="text-center">
        <h2 className="text-lg font-black tracking-tight">{businessName}</h2>
        <p className="mt-1 text-xs text-slate-500">{branchName}</p>
        {branchAddress?.trim() ? (
          <p className="mt-0.5 text-[11px] text-slate-500">{branchAddress.trim()}</p>
        ) : null}
        <div className="my-4 border-t border-dashed border-slate-300" />
        <p className="font-mono text-xs font-semibold">{transactionNumber(sale, locale)}</p>
        <p className="mt-1 text-[11px] text-slate-500">{transactionDate}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          {copy('Cashier')}: {cashierName}
        </p>
      </header>

      {/*
        One stacked hierarchy for 80 mm and 58 mm alike: who the customer is, then (for a member)
        this Sale's point summary. Customer identity and points never compete side by side.
      */}
      <section className="mt-4 space-y-3 text-xs" aria-label={copy('Customer')}>
        <div>
          <p className="font-semibold">{copy('Customer')}</p>
          <p className="mt-1 break-words">{customerDisplayName(customer, locale)}</p>
          {customerDisplayDetail(customer) ? (
            // A phone or reference is one token: it keeps the full width and never breaks per character.
            <p className="whitespace-nowrap text-slate-500">{customerDisplayDetail(customer)}</p>
          ) : null}
        </div>
        {receiptPoints ? (
          <div data-testid="receipt-points">
            <p className="font-semibold">{copy('Points')}</p>
            <dl className="mt-1 space-y-0.5 tabular-nums">
              {receiptPoints.balanceAfter !== null ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{copy('Receipt point balance')}</dt>
                  <dd className="font-bold">{pointQuantity(receiptPoints.balanceAfter, locale)}</dd>
                </div>
              ) : null}
              {receiptPoints.earnedPoints ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{copy('Points gained')}</dt>
                  <dd className="font-semibold">
                    +{pointQuantity(receiptPoints.earnedPoints, locale)}
                  </dd>
                </div>
              ) : null}
              {receiptPoints.redeemedPoints ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{copy('Used')}</dt>
                  <dd className="font-semibold">
                    −{pointQuantity(receiptPoints.redeemedPoints, locale)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </section>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <section className="space-y-2.5">
        {activeLines.map((line) => {
          const lineDiscounts = lineDiscountRows(sale, line, copy('Discount'));
          const additions = saleLineAdditions(line);
          const receiptBase = saleLineBase(line, additions);
          return (
            <div key={line.id} className="text-xs leading-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{line.itemNameSnapshot}</p>
                  {line.variantNameSnapshot ? (
                    <p className="mt-0.5 text-slate-500">{line.variantNameSnapshot}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-bold">{money(line.grossAmount, locale)}</p>
              </div>
              {additions.length ? (
                <>
                  <div className="mt-1 flex items-start justify-between gap-3 text-slate-500">
                    <span>
                      {quantity(line.quantity)} × {money(receiptBase.unitPrice, locale)}
                    </span>
                    <span className="shrink-0">{money(receiptBase.amount, locale)}</span>
                  </div>
                  {/* Customer receipt: only additions chosen during the transaction, as a breakdown of the line total. */}
                  {additions.map((addition) => (
                    <div key={addition.id} className="mt-1 pl-2">
                      <p className="break-words">+ {addition.name}</p>
                      <div className="flex items-start justify-between gap-3 text-slate-500">
                        <span>
                          {quantity(addition.quantity)} × {money(addition.unitPrice, locale)}
                        </span>
                        <span className="shrink-0">{money(addition.amount, locale)}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="mt-1 text-slate-500">
                  {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
                </p>
              )}
              {isPositiveDecimal(line.itemTaxAmount ?? '0') ? (
                <div className="mt-1 flex items-start justify-between gap-3 text-slate-500">
                  <span>{lineTaxLabel(line, copy('Tax'))}</span>
                  <span className="shrink-0">{money(line.itemTaxAmount ?? '0', locale)}</span>
                </div>
              ) : null}
              {lineDiscounts.length ? (
                <div className="mt-1 text-slate-500">
                  <p className="text-[10px] font-semibold">{copy('Discounts and promotions')}</p>
                  {lineDiscounts.map((discount) => (
                    <div key={discount.id} className="pl-2">
                      <p className="break-words">- {discount.title}</p>
                      {discount.note ? (
                        <p className="break-words text-[10px] leading-3">{discount.note}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {line.loyaltyEarning?.state === 'FINALIZED' ? (
                <div className="mt-1 flex items-start justify-between gap-3 text-slate-500">
                  <span>{copy('Points earned')}</span>
                  <span className="shrink-0 font-medium text-slate-950">
                    +{pointQuantity(line.loyaltyEarning.pointsEarned, locale)}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">{copy('Subtotal')}</dt>
          <dd>{money(sale.grossAmount, locale)}</dd>
        </div>
        {hasTax ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{saleTaxLabel(sale, copy('Tax'))}</dt>
            <dd>{money(sale.taxAmount, locale)}</dd>
          </div>
        ) : null}
        {discountRows.length ? (
          <p className="pt-0.5 text-[10px] font-semibold text-slate-500">
            {copy('Discounts and promotions')}
          </p>
        ) : null}
        {discountRows.map((row) => {
          const text = discountPresentation(row, copy('Discount'));
          return (
            <div key={row.id} className="flex items-start justify-between gap-3 pl-2">
              <dt className="min-w-0 text-slate-500">
                {text.title}
                {text.note ? (
                  <span className="block break-words text-[10px] leading-3">{text.note}</span>
                ) : null}
              </dt>
              <dd className="shrink-0">−{money(row.amount, locale)}</dd>
            </div>
          );
        })}
        {hasDiscount && discountRows.length === 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{copy('Discount')}</dt>
            <dd>−{money(sale.discountAmount, locale)}</dd>
          </div>
        ) : null}
        {hasLoyaltyRedemption ? (
          <div className="flex items-start justify-between gap-3">
            <dt className="min-w-0 text-slate-500">
              {copy('Loyalty redemption')}
              <span className="block text-[10px] leading-3">
                {pointQuantity(redeemedPoints, locale)} {copy('points used')}
              </span>
            </dt>
            <dd className="shrink-0">−{money(redeemedAmount!, locale)}</dd>
          </div>
        ) : null}
        <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 text-sm font-black">
          <dt>{copy('Total').toUpperCase()}</dt>
          <dd>{money(sale.totalAmount, locale)}</dd>
        </div>
      </dl>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <section className="space-y-1.5 text-xs">
        <p className="flex justify-between gap-3 font-semibold">
          <span>{copy('Payment')}</span>
          {paymentsSplit ? <span>{copy('Split Payment')}</span> : null}
        </p>
        {paymentLines.map((line) => (
          <div key={line.id} className="flex items-start justify-between gap-3">
            <span className="min-w-0 text-slate-500">
              {line.label}
              {line.reference ? (
                <span className="block break-all font-mono text-[10px]">{line.reference}</span>
              ) : null}
            </span>
            <span className="shrink-0">{money(line.amount, locale)}</span>
          </div>
        ))}
        {paymentsSplit ? (
          <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold">
            <span>{copy('Total paid')}</span>
            <span>{money(paymentsTotal, locale)}</span>
          </div>
        ) : null}
        {cashTenderNote(settlement) ? (
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">{copy('Cash received')}</span>
            <span>{money(settlement.cashTendered!, locale)}</span>
          </div>
        ) : null}
        {cashTenderNote(settlement)?.change ? (
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">{copy('Change')}</span>
            <span>{money(settlement.cashChange!, locale)}</span>
          </div>
        ) : null}
      </section>

      <div className="my-4 border-t border-dashed border-slate-300" />
      <p className="text-center text-[11px] text-slate-500">
        {copy('Thank you for your purchase.')}
      </p>
      <div className="pos-receipt-tear" aria-hidden="true" />
    </>
  );
}
