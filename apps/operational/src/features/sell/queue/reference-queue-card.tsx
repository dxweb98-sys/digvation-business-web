import { DButton, DDropdown as Dropdown } from '@digvation-labs/ui';
import {
  CreditCard,
  Eye,
  MoreHorizontal,
  PlayCircle,
  Printer,
  Send,
  ShoppingBag,
  User,
  XCircle,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { hasStartableQueuedWork } from './queued-sale-work';
import type {
  CompletedSaleSummary,
  QueueSale,
  Sale,
} from '../transaction/model/cashier-transaction.types';
import { ReceiptDeliveryIndicatorLine } from '../receipt/receipt-delivery-dialog';
import type { ReceiptDeliveryIndicator } from '../transaction/api/operational-projection-client';
import { type QueueStatus, statusMeta } from './queue-status';
import {
  hasSuccessfulCheckout,
  financialSummary,
  hasSuccessfulPayment,
} from '../payment/sale-payment-status';
import { money, transactionNumber, isPositiveDecimal } from '../transaction/model/sale-display';
import { customerDisplayName } from '../customer/model/sale-customer-display';

/**
 * A completed transaction for an operator without `sales:read-completed`: it
 * stays recognizable for follow-up, carries no amount, detail or receipt, and
 * offers the one action left, sending the receipt to the customer.
 */
export function RestrictedCompletedQueueCard({
  summary,
  locale,
  receiptDelivery,
  onSendReceipt,
}: {
  summary: CompletedSaleSummary;
  locale: string;
  receiptDelivery: ReceiptDeliveryIndicator | null;
  onSendReceipt: (sale: QueueSale) => void;
}) {
  const { copy, label } = useOperationalLocalization();
  const meta = statusMeta.COMPLETED;
  const number = transactionNumber(summary, locale);
  return (
    <article
      className={`w-[360px] shrink-0 rounded-2xl border border-[var(--color-border)] p-4 transition-shadow hover:shadow-sm ${meta.soft}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-[var(--color-text-muted)]">{number}</p>
          <p className="mt-0.5 truncate text-sm font-bold">
            {customerDisplayName(summary.customer, locale)}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${meta.tone}`}
        >
          {meta.icon}
          {label(meta.value)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[var(--color-text-muted)]">
            {summary.itemCount} {copy('items')},{' '}
            {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
              new Date(summary.finalizedAt ?? summary.createdAt),
            )}
          </p>
          {summary.customer ? <ReceiptDeliveryIndicatorLine indicator={receiptDelivery} /> : null}
        </div>
        <DButton
          size="sm"
          variant="outline"
          className="h-8 shrink-0 px-3 text-[11px]"
          leftIcon={<Send className="size-3.5" />}
          disabled={!summary.customer}
          aria-label={`${copy('Send receipt to customer')} ${number}`}
          {...(summary.customer ? {} : { title: copy('Customer data is not available') })}
          onClick={() => onSendReceipt(summary)}
        >
          {copy('Send receipt')}
        </DButton>
      </div>
    </article>
  );
}

export function ReferenceQueueCard({
  sale,
  status,
  locale,
  issues,
  onStartWork,
  onAdjust,
  canAdjust,
  onPay,
  onCancel,
  onView,
  onViewReceipt,
  onSendReceipt,
  onEditCustomer,
  receiptDelivery = null,
}: {
  sale: Sale;
  status: QueueStatus;
  locale: string;
  issues: string[];
  onStartWork: (sale: Sale) => void;
  onAdjust: (sale: Sale) => void;
  /** False when the session lacks the permission to adjust this Sale in its current state. */
  canAdjust: boolean;
  onPay: (sale: Sale) => void;
  onCancel: (sale: Sale) => void;
  onView: (sale: Sale) => void;
  onViewReceipt: (sale: Sale) => void;
  onSendReceipt: (sale: Sale) => void;
  /** Offered for an unfinished walk-in transaction only. */
  onEditCustomer?: (sale: Sale) => void;
  /** Latest receipt delivery; shown only on a completed transaction with a customer. */
  receiptDelivery?: ReceiptDeliveryIndicator | null;
}) {
  const { copy, label } = useOperationalLocalization();
  const meta = statusMeta[status];
  const { balanceDue } = financialSummary(sale);
  const hasPayment = hasSuccessfulPayment(sale);
  const paid = hasSuccessfulCheckout(sale);
  const customer = sale.customer ?? null;
  const canStartWork = hasStartableQueuedWork(sale);
  const editCustomerItem =
    onEditCustomer &&
    sale.status === 'OPEN' &&
    customer?.type === 'NON_MEMBER' &&
    (status === 'QUEUED' || status === 'PROGRESS')
      ? [
          {
            label: copy('Edit customer'),
            icon: <User className="size-3.5" />,
            onSelect: () => onEditCustomer(sale),
          },
        ]
      : [];
  const actionItems: Array<{
    label: string;
    icon: ReactNode;
    destructive?: boolean;
    onSelect: () => void;
  }> = [
    {
      label: copy('Preview details'),
      icon: <Eye className="size-3.5" />,
      onSelect: () => onView(sale),
    },
    ...(hasPayment
      ? [
          {
            label: copy('View receipt'),
            icon: <Printer className="size-3.5" />,
            onSelect: () => onViewReceipt(sale),
          },
        ]
      : []),
    ...editCustomerItem,
    ...(status === 'COMPLETED' && sale.customer
      ? [
          {
            label: copy('Send receipt to customer'),
            icon: <Send className="size-3.5" />,
            onSelect: () => onSendReceipt(sale),
          },
        ]
      : []),
    ...(status === 'QUEUED'
      ? [
          ...(canStartWork
            ? [
                {
                  label: copy('Start work'),
                  icon: <PlayCircle className="size-3.5" />,
                  onSelect: () => onStartWork(sale),
                },
              ]
            : []),
          ...(canAdjust
            ? [
                {
                  label: copy('Adjust order'),
                  icon: <ShoppingBag className="size-3.5" />,
                  onSelect: () => onAdjust(sale),
                },
              ]
            : []),
          ...(isPositiveDecimal(balanceDue)
            ? [
                {
                  label: copy(hasPayment ? 'Pay balance' : 'Pay'),
                  icon: <CreditCard className="size-3.5" />,
                  onSelect: () => onPay(sale),
                },
              ]
            : []),
          {
            label: copy('Cancel'),
            icon: <XCircle className="size-3.5" />,
            destructive: true,
            onSelect: () => onCancel(sale),
          },
        ]
      : []),
    ...(status === 'PROGRESS'
      ? [
          ...(canAdjust
            ? [
                {
                  label: copy('Adjust order'),
                  icon: <ShoppingBag className="size-3.5" />,
                  onSelect: () => onAdjust(sale),
                },
              ]
            : []),
          ...(isPositiveDecimal(balanceDue)
            ? [
                {
                  label: copy(hasPayment ? 'Pay balance' : 'Pay'),
                  icon: <CreditCard className="size-3.5" />,
                  onSelect: () => onPay(sale),
                },
              ]
            : []),
          {
            label: copy('Cancel'),
            icon: <XCircle className="size-3.5" />,
            destructive: true,
            onSelect: () => onCancel(sale),
          },
        ]
      : []),
  ];

  return (
    <article
      className={`w-[360px] shrink-0 rounded-2xl border border-[var(--color-border)] p-4 transition-shadow hover:shadow-sm ${meta.soft}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
            {transactionNumber(sale, locale)}
          </p>
          <p className="mt-0.5 truncate text-sm font-bold">
            {customerDisplayName(customer, locale)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${paid ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'}`}
          >
            {copy(paid ? 'Paid' : hasPayment ? 'Partially paid' : 'Unpaid')}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${meta.tone}`}
          >
            {meta.icon}
            {label(meta.value)}
          </span>
        </div>
      </div>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {sale.lines.filter((line) => !line.removedAt).length} {copy('items')},{' '}
            {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
              new Date(sale.createdAt),
            )}
          </p>
          <p className="mt-1 text-sm font-bold text-[var(--color-brand)]">
            {money(sale.totalAmount, locale)}
          </p>
          {status === 'COMPLETED' && sale.customer ? (
            <ReceiptDeliveryIndicatorLine indicator={receiptDelivery} />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {canStartWork ? (
            <DButton
              size="sm"
              className="h-8 px-3 text-[11px]"
              leftIcon={<PlayCircle className="size-3.5" />}
              onClick={() => onStartWork(sale)}
            >
              {copy('Start work')}
            </DButton>
          ) : null}
          <Dropdown
            placement="bottom-end"
            contentRole="menu"
            closeOnItemClick
            contentClassName="min-w-[172px] overflow-hidden p-1"
            trigger={({ open }) => (
              <button
                type="button"
                aria-label={`${copy('Actions for')} ${transactionNumber(sale, locale)}`}
                aria-expanded={open}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[11px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
              >
                <MoreHorizontal className="size-4" />
              </button>
            )}
          >
            {actionItems.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={item.onSelect}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors ${item.destructive ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10' : 'text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]'}`}
              >
                {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                {item.label}
              </button>
            ))}
          </Dropdown>
        </div>
      </div>
      {issues.length ? (
        <div className="mt-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-xs">
          <p className="font-semibold text-[var(--color-warning)]">
            {copy('Complete before starting')}
          </p>
          <p className="mt-0.5 text-[var(--color-text-muted)]">{issues[0]}</p>
        </div>
      ) : null}
    </article>
  );
}
