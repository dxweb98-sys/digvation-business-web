import { DTabs, DTabsContent, DTabsList, DTabsTrigger } from '@digvation/ui';
import { ChevronDown, Clock } from 'lucide-react';
import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { QueueSale, Sale } from '../transaction/model/cashier-transaction.types';
import {
  isCompletedSaleSummary,
  restrictedQueueSummary,
} from '../transaction/model/completed-sale-visibility';
import type { ReceiptDeliveryIndicator } from '../transaction/api/operational-projection-client';
import { type QueueStatus, statusMeta } from './queue-status';
import { RestrictedCompletedQueueCard, ReferenceQueueCard } from './reference-queue-card';

export function ReferenceQueueBoard({
  open,
  onOpenChange,
  active,
  onChangeTab,
  groups,
  issues,
  locale,
  onStartWork,
  onAdjust,
  canAdjust,
  onPay,
  onCancel,
  onView,
  onViewReceipt,
  canReadCompleted,
  onSendReceipt,
  receiptDeliveries,
  onEditCustomer,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  active: QueueStatus;
  onChangeTab: (status: QueueStatus) => void;
  groups: Record<QueueStatus, QueueSale[]>;
  issues: Record<string, string[]>;
  locale: string;
  onStartWork: (sale: Sale) => void;
  onAdjust: (sale: Sale) => void;
  canAdjust: (sale: Sale) => boolean;
  onPay: (sale: Sale) => void;
  onCancel: (sale: Sale) => void;
  onView: (sale: Sale) => void;
  onViewReceipt: (sale: Sale) => void;
  canReadCompleted: boolean;
  onSendReceipt: (sale: QueueSale) => void;
  /** Latest receipt delivery per completed transaction, kept beside the queue items. */
  receiptDeliveries: Readonly<Record<string, ReceiptDeliveryIndicator>>;
  /** Corrects a walk-in customer before the transaction is completed. */
  onEditCustomer: (sale: Sale) => void;
}) {
  const { copy, label } = useOperationalLocalization();
  const statuses = Object.keys(statusMeta) as QueueStatus[];
  const count = groups.QUEUED.length + groups.PROGRESS.length;
  const statusLabel = (status: QueueStatus) => label(statusMeta[status].value);
  return (
    <div className="mb-4 shrink-0">
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-muted)]/40"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-2xl ${count ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}
            >
              <Clock className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">{copy('Queue transactions')}</p>
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-bold ${count ? 'bg-[var(--color-brand)] text-white' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}
                >
                  {count}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                {count
                  ? copy('Click to view active transactions.')
                  : copy('No queued transactions.')}
              </p>
            </div>
          </div>
          <div className="pos-queue-status-summary items-center gap-2">
            {statuses.map((status) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold ${statusMeta[status].tone}`}
              >
                {statusMeta[status].icon}
                {statusLabel(status)}
                <span>{groups[status].length}</span>
              </span>
            ))}
            <ChevronDown
              className={`size-[18px] text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </div>
          <ChevronDown
            className={`size-[18px] text-[var(--color-text-muted)] transition-transform md:hidden ${open ? 'rotate-180' : ''}`}
          />
        </button>
        <div className={`pos-collapsible grid ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <DTabs
              value={active}
              defaultValue={active}
              onValueChange={(value) => onChangeTab(value as QueueStatus)}
              className="border-t border-[var(--color-border)] p-3"
            >
              <DTabsList className="max-w-full overflow-x-auto">
                {statuses.map((status) => (
                  <DTabsTrigger key={status} value={status}>
                    {statusLabel(status)} ({groups[status].length})
                  </DTabsTrigger>
                ))}
              </DTabsList>
              {statuses.map((status) => {
                const list = groups[status];
                const contentKey = `${status}:${list
                  .map((sale) => `${sale.id}:${sale.updatedAt}`)
                  .join('|')}`;
                return (
                  <DTabsContent key={status} value={status} className="mt-3">
                    <div key={contentKey} className="pos-queue-content-enter space-y-3">
                      {list.length ? (
                        <div className="no-scrollbar cursor-grab overflow-x-auto overflow-y-hidden pb-3 select-none">
                          <div className="flex w-max gap-4 px-0.5">
                            {list.map((sale) => {
                              // A completed transaction without the permission is
                              // shown from its summary alone, even if a full copy is cached.
                              const summary = restrictedQueueSummary(sale, canReadCompleted);
                              if (summary)
                                return (
                                  <RestrictedCompletedQueueCard
                                    key={sale.id}
                                    summary={summary}
                                    locale={locale}
                                    receiptDelivery={receiptDeliveries[sale.id] ?? null}
                                    onSendReceipt={onSendReceipt}
                                  />
                                );
                              // Every summary entry was presented above; what remains is a full Sale.
                              if (isCompletedSaleSummary(sale)) return null;
                              return (
                                <ReferenceQueueCard
                                  key={sale.id}
                                  sale={sale}
                                  status={status}
                                  locale={locale}
                                  issues={issues[sale.id] ?? []}
                                  onStartWork={onStartWork}
                                  onAdjust={onAdjust}
                                  canAdjust={canAdjust(sale)}
                                  onPay={onPay}
                                  onCancel={onCancel}
                                  onView={onView}
                                  onViewReceipt={onViewReceipt}
                                  onSendReceipt={onSendReceipt}
                                  onEditCustomer={onEditCustomer}
                                  receiptDelivery={receiptDeliveries[sale.id] ?? null}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/20 py-7 text-center">
                          <p className="text-sm font-semibold">
                            {copy('No transactions in this status.')}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            {copy('Transactions appear here after they are created.')}
                          </p>
                        </div>
                      )}
                    </div>
                  </DTabsContent>
                );
              })}
            </DTabs>
          </div>
        </div>
      </div>
    </div>
  );
}
