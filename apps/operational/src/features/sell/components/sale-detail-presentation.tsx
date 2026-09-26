import { DBadge, DCard, DCardContent, DCardFooter, DCardHeader, DSeparator } from '@digvation/ui';
import type { ReactNode } from 'react';

import './sale-detail-presentation.css';

import {
  discountPresentation,
  type DiscountPresentationRow,
  type DiscountPresentationText,
  type SaleSettlement,
} from '../sale-presentation';

/**
 * Presentation primitives for the Operational transaction detail and receipt.
 * They only lay out authoritative Sale values that callers have already formatted.
 */

export function SaleDetailHeader({
  eyebrow,
  number,
  secondaryNumber,
  badges,
  totalLabel,
  total,
  settlementNote,
  meta,
}: {
  eyebrow: string;
  number: string;
  secondaryNumber?: string | null | undefined;
  badges: ReactNode;
  totalLabel: string;
  total: string;
  settlementNote?: ReactNode;
  meta: readonly { label: string; value: ReactNode }[];
}) {
  return (
    <section className="pos-detail-header">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            {eyebrow}
          </p>
          <p className="mt-1 break-all font-mono text-[15px] font-semibold leading-6 text-[var(--color-text)]">
            {number}
          </p>
          {secondaryNumber ? (
            <p className="font-mono text-xs text-[var(--color-text-muted)]">{secondaryNumber}</p>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{badges}</div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            {totalLabel}
          </p>
          <p className="mt-1 text-2xl font-bold leading-8 tabular-nums text-[var(--color-text)]">
            {total}
          </p>
          {settlementNote ? (
            <div className="mt-0.5 text-xs font-semibold">{settlementNote}</div>
          ) : null}
        </div>
      </div>
      {meta.length ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[var(--color-border)] pt-4">
          {meta.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-xs text-[var(--color-text-muted)]">{item.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--color-text)]">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

export function StatusPill({
  tone,
  icon,
  children,
}: {
  tone: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
  children: ReactNode;
}) {
  // The design system owns the badge; this only maps the tone vocabulary of the detail.
  const variants = {
    neutral: 'default',
    brand: 'primary',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
  } as const;
  return (
    <DBadge variant={variants[tone]} className="gap-1 font-semibold">
      {icon}
      {children}
    </DBadge>
  );
}

export function SaleDetailSection({
  title,
  aside,
  /** `panel` for scannable lists, `muted` for the money summary, `plain` for bare content. */
  surface = 'panel',
  children,
}: {
  title: string;
  aside?: ReactNode;
  surface?: 'plain' | 'panel' | 'muted';
  children: ReactNode;
}) {
  if (surface === 'plain') {
    return (
      <section className="pos-detail-section">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
          {aside ? <span className="text-xs text-[var(--color-text-muted)]">{aside}</span> : null}
        </div>
        {children}
      </section>
    );
  }
  // A card with its title in the card header, the same shape as the summary card beside it.
  return (
    <DCard
      variant="outlined"
      className={`pos-detail-panel overflow-hidden ${surface === 'muted' ? 'bg-[var(--color-surface-muted)]/50' : ''}`}
    >
      <DCardHeader className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
        {aside ? <span className="text-xs text-[var(--color-text-muted)]">{aside}</span> : null}
      </DCardHeader>
      <DCardContent className="px-4 py-0">{children}</DCardContent>
    </DCard>
  );
}

export function SaleLineItemList({ children }: { children: ReactNode }) {
  return <ul className="pos-line-list divide-y divide-[var(--color-border)]">{children}</ul>;
}

/**
 * One order row. Space inside an item stays tight and space between items is
 * wider, so each item reads as one unit without adding a card per item. The
 * money column on the right carries the line total and any discount.
 */
export function SaleLineItem({
  name,
  variant,
  pricing,
  amount,
  discounts = [],
  earning,
  context,
  detail,
  action,
}: {
  name: string;
  variant?: string | null;
  /** Quantity × unit price. */
  pricing: string;
  amount: string;
  /** Discounts on this line, each with its own title, optional note and amount. */
  discounts?: readonly { id: string; title: string; note: string | null; amount: string }[];
  /** Compact Runtime-authoritative Loyalty preview or finalized fact. */
  earning?: ReactNode;
  /** Secondary operational context such as fulfillment status and performers. */
  context?: ReactNode;
  /** A full-width block under the context row, such as who performs the service. */
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="pos-line-item">
      <div className="flex min-w-0 items-baseline justify-between gap-4">
        <p className="min-w-0 break-words text-sm font-semibold leading-5 text-[var(--color-text)]">
          {name}
        </p>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text)]">
          {amount}
        </span>
      </div>
      <p className="mt-0.5 flex min-w-0 flex-wrap gap-x-3 text-xs tabular-nums text-[var(--color-text-muted)]">
        {variant ? <span className="min-w-0 break-words">{variant}</span> : null}
        <span>{pricing}</span>
      </p>
      {earning ? (
        <p className="mt-1 text-xs font-medium text-[var(--color-success)]">{earning}</p>
      ) : null}
      {discounts.map((discount) => (
        <div key={discount.id} className="mt-1 flex items-start justify-between gap-4 text-xs">
          <span className="min-w-0 text-[var(--color-text-muted)]">
            {discount.title}
            {discount.note ? (
              <span className="block break-words text-[11px] leading-4">{discount.note}</span>
            ) : null}
          </span>
          <span className="shrink-0 font-medium tabular-nums text-[var(--color-danger)]">
            −{discount.amount}
          </span>
        </div>
      ))}
      {context || action ? (
        <div className="mt-1.5 flex min-w-0 items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            {context}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {detail}
    </li>
  );
}

/** Discount title with its supporting note underneath; the note never becomes the title. */
function DiscountTerm({
  text,
  context,
}: {
  text: DiscountPresentationText;
  context: string | null;
}) {
  const note = text.note ?? context;
  return (
    <dt className="min-w-0 text-[var(--color-text-muted)]">
      <span className="text-[var(--color-text)]">{text.title}</span>
      {note ? <span className="block break-words text-xs">{note}</span> : null}
    </dt>
  );
}

export function SaleFinancialSummary({
  title,
  context,
  labels,
  gross,
  discounts,
  adjustments = [],
  tax,
  total,
  settlement,
  format,
  payment,
  paymentAttempts,
}: {
  title?: string;
  context?: ReactNode;
  labels: {
    subtotal: string;
    total: string;
    paid: string;
    balance: string;
    settled: string;
    cashReceived: string;
    change: string;
    /** Title word of a manual discount, for example "Diskon". */
    discount: string;
    /** Source and scope context shown under a promotion, for example "Promo · Whole transaction". */
    discountContext: (row: DiscountPresentationRow) => string;
  };
  gross: string;
  discounts: readonly DiscountPresentationRow[];
  /** Authoritative non-promotion deductions, such as a recorded Loyalty redemption. */
  adjustments?: readonly { id: string; label: string; detail?: string | null; amount: string }[];
  tax: { label: string; amount: string } | null;
  total: string;
  settlement: SaleSettlement;
  format: (amount: string) => string;
  payment?: { title: string; aside?: ReactNode; content: ReactNode } | null;
  paymentAttempts?: ReactNode;
}) {
  const hasBalance = settlement.balanceDue !== '0.0000';
  // A settled sale whose payments equal its total says so once, as a badge. The
  // paid and balance rows only appear when they add information.
  const settledExactly = !hasBalance && settlement.totalPaid === total;
  // Cash received only adds information when it differs from what was applied (change was given).
  const cashNotes = [
    settlement.cashTendered &&
    (settlement.cashChange || settlement.cashTendered !== settlement.totalPaid)
      ? { label: labels.cashReceived, amount: settlement.cashTendered }
      : null,
    settlement.cashChange ? { label: labels.change, amount: settlement.cashChange } : null,
  ].filter((note) => note !== null);
  const settlementRows = !settledExactly || payment === null || payment === undefined;
  // One card, three zones: who (header), how much (content), how it was settled (footer).
  return (
    <DCard variant="outlined" className="pos-financial-panel overflow-hidden">
      {context ? <DCardHeader className="py-3.5">{context}</DCardHeader> : null}
      <DCardContent>
        {title ? <h3 className="sr-only">{title}</h3> : null}
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-text-muted)]">{labels.subtotal}</dt>
            <dd className="tabular-nums">{format(gross)}</dd>
          </div>
          {discounts.map((row) => (
            <div key={row.id} className="flex items-start justify-between gap-4">
              <DiscountTerm
                text={discountPresentation(row, labels.discount)}
                context={row.source === 'PROMOTION' ? labels.discountContext(row) : null}
              />
              <dd className="shrink-0 tabular-nums text-[var(--color-danger)]">
                −{format(row.amount)}
              </dd>
            </div>
          ))}
          {adjustments.map((adjustment) => (
            <div key={adjustment.id} className="flex items-start justify-between gap-4">
              <dt className="min-w-0 text-[var(--color-text-muted)]">
                <span className="text-[var(--color-text)]">{adjustment.label}</span>
                {adjustment.detail ? (
                  <span className="block break-words text-xs">{adjustment.detail}</span>
                ) : null}
              </dt>
              <dd className="shrink-0 tabular-nums text-[var(--color-danger)]">
                −{format(adjustment.amount)}
              </dd>
            </div>
          ))}
          {tax ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-text-muted)]">{tax.label}</dt>
              <dd className="tabular-nums">{format(tax.amount)}</dd>
            </div>
          ) : null}
        </dl>
        <DSeparator className="my-3" />
        <dl>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm font-semibold">{labels.total}</dt>
            <dd className="text-2xl font-bold leading-8 tabular-nums">{format(total)}</dd>
          </div>
        </dl>
      </DCardContent>

      <DCardFooter className="bg-[var(--color-surface-muted)]/50 py-3.5">
        <div className="flex min-h-6 items-center justify-between gap-3">
          {payment ? (
            <h4 className="text-sm font-semibold text-[var(--color-text)]">{payment.title}</h4>
          ) : (
            <span />
          )}
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            {payment?.aside}
            {!hasBalance ? (
              <DBadge variant="success" dot className="font-semibold">
                {labels.settled}
              </DBadge>
            ) : null}
          </span>
        </div>
        {settlementRows ? (
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-text-muted)]">{labels.paid}</dt>
              <dd className="tabular-nums">{format(settlement.totalPaid)}</dd>
            </div>
            {hasBalance ? (
              <div className="flex justify-between gap-4 font-semibold">
                <dt>{labels.balance}</dt>
                <dd className="tabular-nums text-[var(--color-warning)]">
                  {format(settlement.balanceDue)}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {payment ? <div className="mt-1">{payment.content}</div> : null}
        {cashNotes.length ? (
          <dl className="mt-1 space-y-1 text-xs text-[var(--color-text-muted)]">
            {cashNotes.map((note) => (
              <div key={note.label} className="flex justify-between gap-4">
                <dt>{note.label}</dt>
                <dd className="tabular-nums">{format(note.amount)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {paymentAttempts ? (
          <>
            <DSeparator className="my-3" />
            <section>{paymentAttempts}</section>
          </>
        ) : null}
      </DCardFooter>
    </DCard>
  );
}

/**
 * How the transaction was paid: only the payments that settled it. The split indicator belongs
 * to the section title and the paid total to the summary, so a single payment stays one plain row.
 */
export function SalePaymentComposition({
  components,
}: {
  components: readonly {
    id: string;
    /** Settlement account name, or the method when no account was recorded. */
    name: string;
    /** Payment method, shown only when it differs from the name. */
    method: string | null;
    reference: string | null;
    amount: string;
  }[];
}) {
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {components.map((component) => (
        <li key={component.id} className="flex items-start justify-between gap-4 py-2.5">
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-[var(--color-text)]">
              {component.name}
            </p>
            {component.method || component.reference ? (
              <p className="mt-0.5 break-all text-xs text-[var(--color-text-muted)]">
                {[component.method, component.reference].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums">{component.amount}</span>
        </li>
      ))}
    </ul>
  );
}

export function SalePaymentList({
  payments,
  emptyLabel,
}: {
  payments: readonly {
    id: string;
    method: string;
    status: ReactNode;
    detail: string;
    amount: string;
  }[];
  emptyLabel: string;
}) {
  if (!payments.length) {
    return <p className="py-2 text-xs text-[var(--color-text-muted)]">{emptyLabel}</p>;
  }
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {payments.map((payment) => (
        <li key={payment.id} className="flex items-start justify-between gap-4 py-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium">{payment.method}</span>
              {payment.status}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
              {payment.detail}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums">{payment.amount}</span>
        </li>
      ))}
    </ul>
  );
}
