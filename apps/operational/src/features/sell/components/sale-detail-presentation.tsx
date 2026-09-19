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
  const tones = {
    neutral: 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
    brand: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]',
    success: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {icon}
      {children}
    </span>
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
  const surfaceClass =
    surface === 'panel'
      ? 'pos-detail-panel'
      : surface === 'muted'
        ? 'pos-detail-panel pos-detail-panel--muted'
        : '';
  return (
    <section className="pos-detail-section">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
        {aside ? <span className="text-xs text-[var(--color-text-muted)]">{aside}</span> : null}
      </div>
      <div className={surfaceClass}>{children}</div>
    </section>
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
  labels,
  gross,
  discounts,
  tax,
  total,
  settlement,
  format,
}: {
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
  tax: { label: string; amount: string } | null;
  total: string;
  settlement: SaleSettlement;
  format: (amount: string) => string;
}) {
  const hasBalance = settlement.balanceDue !== '0.0000';
  return (
    <div className="pos-detail-summary">
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
        {tax ? (
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-text-muted)]">{tax.label}</dt>
            <dd className="tabular-nums">{format(tax.amount)}</dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-4 border-t border-[var(--color-border)] pt-2.5">
          <dt className="text-sm font-semibold">{labels.total}</dt>
          <dd className="text-lg font-bold tabular-nums">{format(total)}</dd>
        </div>
      </dl>
      <dl className="mt-3 space-y-1.5 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)]/55 px-3 py-2.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--color-text-muted)]">{labels.paid}</dt>
          <dd className="tabular-nums">{format(settlement.totalPaid)}</dd>
        </div>
        <div className="flex justify-between gap-4 font-semibold">
          <dt>{labels.balance}</dt>
          <dd
            className={`tabular-nums ${hasBalance ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}`}
          >
            {hasBalance ? format(settlement.balanceDue) : labels.settled}
          </dd>
        </div>
        {settlement.cashTendered ? (
          <div className="flex justify-between gap-4 text-xs text-[var(--color-text-muted)]">
            <dt>{labels.cashReceived}</dt>
            <dd className="tabular-nums">{format(settlement.cashTendered)}</dd>
          </div>
        ) : null}
        {settlement.cashChange ? (
          <div className="flex justify-between gap-4 text-xs text-[var(--color-text-muted)]">
            <dt>{labels.change}</dt>
            <dd className="tabular-nums">{format(settlement.cashChange)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
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
