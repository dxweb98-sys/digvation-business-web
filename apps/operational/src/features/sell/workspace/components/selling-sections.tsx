import { useAuth } from '@digvation/pos-auth';
import { ApiClient } from '@digvation/business-api';
import { createDecimal, formatMoney } from '@digvation/pos-money';
import { useRuntime } from '@digvation/pos-runtime';
import {
  DAlert,
  DBadge as Badge,
  DButton,
  DButton as Button,
  DConfirmDialog,
  DDialog,
  DDialog as Dialog,
  DDropdown as Dropdown,
  DInput,
  DRadio,
  DSearchInput as SearchInput,
  DSelect as Select,
  DSkeleton as Skeleton,
  useToast,
} from '@digvation-labs/ui';
import {
  DAvatar,
  DDropdown as PortalDropdown,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  DTextarea,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  Info,
  Minus,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  Plus,
  Printer,
  Send,
  QrCode,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import {
  QUEUE_REFRESH_INTERVAL_MS,
  liveQueryPolicy,
} from '../../../../app/data/operational-cache-policy';
import {
  operationalCopy,
  resolveOperationalLocale,
  useOperationalLocalization,
} from '../../../../app/localization/operational-localization';
import { useOperationalAccessContext } from '../../../../modules/operational/operational-access-api';
import { resolveReceiptLocation } from '../../../../modules/operational/operational-location-selection';
import { cashierTransactionKeys } from '../../cashier-transaction-keys';
import {
  cashierTransactionErrorMessage,
  correctionErrorMessage,
} from '../../cashier-transaction-errors';
import type { ReplaceLinePreview, ReplaceSaleLineInput } from '../../cashier-transaction.adapter';
import { replacementLinesOf } from '../../cart-draft';
import { visibleCatalogItems } from '../../selling-catalog-eligibility';
import { saleLineConfiguration } from '../../sale-line-additions';
import {
  ItemConfigurator,
  type ItemConfiguration,
  type ItemConfiguratorState,
} from '../../components/item-configurator';
import { AddTransactionItemDialog, CatalogItemAutocomplete } from '../../components/transaction-item-dialog';
import { CustomerMemberApi, type MemberLookupResult } from '../../customer-member-api';
import type { CartDisplayLine } from '../../cart-draft';
import {
  createCashierTransactionAdapter,
  isLocalCashierDemoEnabled,
} from '../../cashier-transaction-adapter-factory';
import { hasStartableQueuedWork, saleLineWorkStatus } from '../../queued-sale-work';
import { correctionSourceOf, saleLineAdjustmentMode } from '../../sale-adjustment-access';
import {
  appliedPaymentComposition,
  employeeDisplayName,
  formatServiceDuration,
  lineDiscountPercentage,
  saleDiscountRows,
  aggregateDiscountRows,
  lineTaxLabel,
  cashTenderNote,
  type DiscountDetails,
  discountPresentation,
  lineDiscountRows,
  paymentIntent,
  paymentProgress,
  saleSettlement,
  saleTaxLabel,
  transactionDiscountLabel,
} from '../../sale-presentation';
import type {
  CatalogItem,
  ComponentCandidate,
  CompletedSaleSummary,
  Employee,
  Payment,
  PaymentMethod,
  PaymentRoute,
  PaymentStatus,
  QueueSale,
  Sale,
  SaleCustomer,
  SaleLine,
} from '../../cashier-transaction.types';
import type { CatalogItemTypeFilter } from '../../use-selling-catalog';
import type { useCashierTransactionWorkspace } from '../../use-cashier-transaction-workspace';

import {
  amountFractionDigits,
  currencyInputFromAmount,
  normalizeCurrencyPaymentInput,
  PosCurrencyInput,
  PosNumericInput,
} from '../../components/pos-controls';
import {
  SaleCustomerStrip,
  SaleDetailSection,
  SaleFinancialSummary,
  SaleLineAdditions,
  SaleLineItem,
  SaleLineItemList,
  SalePaymentComposition,
  SalePaymentList,
  StatusPill,
} from '../../components/sale-detail-presentation';
import { additionPerformedBy, saleLineAdditions, saleLineBase } from '../../sale-line-additions';
import { CartLineBreakdown } from '../../components/cart-line-breakdown';
import {
  PaymentIntentHint,
  PaymentLeaveNotice,
  PaymentProgressSummary,
  PaymentReview,
  RecordedPaymentList,
} from '../../components/payment-confirmation';
import { SaleAdjustmentControls } from '../../components/sale-adjustment-controls';
import { SaleLineTaskDialog } from '../../components/sale-line-task-dialog';
import {
  ServicePerformersDialog,
  serviceWorkUnitAllocations,
  serviceWorkUnitCount,
} from '../../components/service-performers-dialog';
import {
  formatPercent,
  formatUnitRanges,
  groupAllocations,
  resolveAllocation,
  type PerformerAllocation,
  type ServiceLineWorkPlan,
} from '../../service-performer-allocation';
import {
  isCompletedSaleSummary,
  presentableTransaction,
  restrictedQueueSummary,
  useCanReadCompletedSaleDetails,
} from '../../completed-sale-visibility';
import {
  activeMemberOf,
  needsMemberIdentityLookup,
  presentedCustomer,
} from '../../member-cart-presentation';
import { CustomerMemberDialog } from '../../components/customer-member-dialog';
import {
  WalkInCustomerEditDialog,
  type WalkInCustomerEditTarget,
} from '../../components/walk-in-customer-edit-dialog';
import {
  ReceiptDeliveryDialog,
  ReceiptDeliveryIndicatorLine,
  receiptDeliveryPreviewLabel,
  receiptDeliveryStatusKey,
  type ReceiptDeliveryTarget,
} from '../../components/receipt-delivery-dialog';
import { receiptDeliveryPhase } from '../../receipt-delivery';
import type {
  ReceiptDeliveryIndicator,
  ReceiptDeliveryState,
} from '../../operational-projection-client';
import { useCustomerPickerSession } from '../../customer-picker-session';
import { canAdjustOrder } from '../../sale-adjustment-access';
import {
  completeSettledCheckout,
  hasTrackedWork,
  isFullySettled,
  isInstantOnly,
} from '../../sale-lifecycle';


import {
  CANCELED_SALE_REASONS_KEY,
  PerformerCredits,
  ServicePerformers,
  VISIBLE_AVATARS,
  VISIBLE_PERFORMER_GROUPS,
  copyFor,
  customerDisplayDetail,
  customerDisplayName,
  customerInitials,
  customerStatus,
  employeeAssignmentIssues,
  financialSummary,
  formatDurationMinutes,
  groupWorkflowIssues,
  hasSuccessfulCheckout,
  hasSuccessfulPayment,
  isPositiveDecimal,
  money,
  paymentAccountLabel,
  pointQuantity,
  processIssues,
  quantity,
  queueStatus,
  readCancellationReasons,
  readQueuedSaleEntries,
  receiptPointSummary,
  saleEarnedPoints,
  servicePerformerSummary,
  statusMeta,
  successfulPayments,
  transactionNumber,
  wholePointValue,
  workflowIssues,
  writeCancellationReason,
  writeQueuedSaleEntries,
  type FulfillmentDestination,
  type QueueStatus,
  type QueuedSaleEntry,
  type TerminalPaymentStatus,
} from '../presentation/workspace-presentation';

export function ReferenceTypeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold transition-all duration-200 active:scale-[.98] sm:px-4 ${active ? 'bg-[var(--color-background)] text-[var(--color-brand)] shadow-sm ring-1 ring-[var(--color-border)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-background)]/60 hover:text-[var(--color-text)]'}`}
    >
      {icon}
      {label}
    </button>
  );
}

/** Initials that stand in for an item photo, e.g. "Hair Spa" -> "HS", "Manicure" -> "Ma". */
export function itemMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  const word = words[0] ?? '';
  return `${word.charAt(0).toUpperCase()}${word.charAt(1).toLowerCase()}`;
}

/**
 * The card's media band: the item photo edge to edge, or its initials on a
 * soft tint filling the same band, so every card keeps one height and one
 * rhythm whether or not a photo exists.
 */
export function CatalogItemMedia({ item }: { item: CatalogItem }) {
  const isService = item.type === 'SERVICE';
  const imageUrl = item.image?.url;
  return (
    <span
      aria-hidden="true"
      className={`relative block aspect-[4/3] w-full overflow-hidden border-b sm:aspect-[3/2] border-[var(--color-border)] ${
        imageUrl
          ? 'bg-[var(--color-surface-muted)]'
          : isService
            ? 'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-brand)_14%,var(--color-surface))_0%,color-mix(in_srgb,var(--color-brand)_5%,var(--color-surface))_100%)] text-[var(--color-brand)]'
            : 'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent-mint)_70%,var(--color-surface))_0%,color-mix(in_srgb,var(--color-accent-mint)_30%,var(--color-surface))_100%)] text-[var(--color-text)]'
      }`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full bg-[var(--color-surface)]/70 text-lg font-semibold tracking-wide shadow-sm ring-1 ring-inset ring-current/10 sm:size-16 sm:text-xl">
            {itemMonogram(item.name)}
          </span>
        </span>
      )}
    </span>
  );
}

export function ReferenceCatalogCard({
  item,
  price,
  locale,
  disabled,
  onAdd,
}: {
  item: CatalogItem;
  price: string | null;
  locale: string;
  disabled: boolean;
  onAdd: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const displayPrice = item.displayPrice;
  const variantCount = item.variants?.length ?? 0;
  const needsVariantChoice = variantCount > 0;
  const choiceLabel = item.variantSelectionMode === 'OPTIONAL' ? 'Choose option' : 'Choose variant';
  const duration = formatDurationMinutes(item.serviceDefinition?.defaultDurationMinutes, locale);
  return (
    <button
      type="button"
      aria-label={`${copy(needsVariantChoice ? choiceLabel : 'Add')} ${item.name}`}
      disabled={disabled}
      onClick={onAdd}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left transition-all hover:border-[var(--color-brand)]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/40 active:scale-[.98] disabled:opacity-50"
    >
      <CatalogItemMedia item={item} />
      <span className="flex min-w-0 flex-1 flex-col gap-3 p-3">
        {/* Identity: a quiet reference line (code, plus duration when the item has one) over the name. */}
        <span className="block min-w-0">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-[var(--color-text-muted)]">
            <span className="truncate font-mono tracking-tight">{item.code}</span>
            {duration ? (
              <span className="flex shrink-0 items-center gap-1">
                <span aria-hidden="true">·</span>
                <Clock className="size-3" aria-hidden="true" />
                {duration}
              </span>
            ) : null}
          </span>
          <span className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-text)]">
            {item.name}
          </span>
        </span>
        {/* Commerce: price and action stay anchored to the bottom, so they line up across a grid row. */}
        <span className="mt-auto block border-t border-[var(--color-border)]/70 pt-2.5">
          {price ? (
            <span className="flex items-baseline gap-1 tabular-nums">
              {displayPrice?.kind === 'FROM' ? (
                <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
                  {copy('From')}
                </span>
              ) : null}
              <span className="text-sm font-bold text-[var(--color-text)]">
                {money(price, locale)}
              </span>
            </span>
          ) : (
            <span className="block text-[11px] leading-5 text-[var(--color-text-muted)]">
              {copy('Price available when selected')}
            </span>
          )}
          {/* Both outcomes share one treatment; the wording and icon say whether a picker opens first. */}
          <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold leading-4 text-[var(--color-brand)]">
            {needsVariantChoice ? (
              <>
                {copy(choiceLabel)}
                <ChevronRight
                  className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </>
            ) : (
              <>
                <Plus
                  className="size-3.5 shrink-0 transition-transform group-hover:rotate-90 motion-reduce:transition-none"
                  aria-hidden="true"
                />
                {copy('Add')}
              </>
            )}
          </span>
        </span>
      </span>
    </button>
  );
}

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

export function ReferenceFloatingCart({
  open,
  onOpenChange,
  lines,
  total,
  gross,
  discountAmount,
  discountLabel,
  taxAmount,
  taxLabel,
  isEstimate,
  isTaxPreviewLoading,
  isTaxPreviewUnavailable,
  locale,
  customer,
  memberNumber,
  pointBalance,
  isPointBalanceLoading,
  onChooseCustomer,
  onQuantity,
  onEdit,
  onRemove,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  lines: readonly CartDisplayLine[];
  total: string;
  gross: string;
  discountAmount: string;
  discountLabel: string;
  taxAmount: string;
  taxLabel: string;
  isEstimate: boolean;
  isTaxPreviewLoading: boolean;
  isTaxPreviewUnavailable: boolean;
  locale: string;
  customer: SaleCustomer | null;
  memberNumber: string | null;
  pointBalance: string | null;
  isPointBalanceLoading: boolean;
  onChooseCustomer: () => void;
  onQuantity: (line: CartDisplayLine, quantity: string) => void;
  onEdit: (line: CartDisplayLine, options?: { addUnit?: boolean }) => void;
  onRemove: (line: CartDisplayLine) => void;
  onCheckout: () => void;
}) {
  const { copy } = useOperationalLocalization();
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      onOpenChange(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onOpenChange, open]);
  const panel = (
    <ReferenceCartPanel
      lines={lines}
      total={total}
      gross={gross}
      discountAmount={discountAmount}
      discountLabel={discountLabel}
      taxAmount={taxAmount}
      taxLabel={taxLabel}
      isEstimate={isEstimate}
      isTaxPreviewLoading={isTaxPreviewLoading}
      isTaxPreviewUnavailable={isTaxPreviewUnavailable}
      locale={locale}
      customer={customer}
      memberNumber={memberNumber}
      pointBalance={pointBalance}
      isPointBalanceLoading={isPointBalanceLoading}
      onChooseCustomer={onChooseCustomer}
      onQuantity={onQuantity}
      onEdit={onEdit}
      onRemove={onRemove}
      onCheckout={onCheckout}
    />
  );
  const countLabel = lines.length
    ? `${lines.length} ${copy('items selected')}`
    : copy('No items selected');
  return (
    <>
      <button
        type="button"
        aria-label={copy('Close active cart')}
        onClick={() => onOpenChange(false)}
        className={`operational-cart-backdrop fixed inset-0 z-40 bg-transparent ${open ? '' : 'pointer-events-none'}`}
      />
      <button
        type="button"
        aria-label={copy('Cart')}
        onClick={() => onOpenChange(!open)}
        className={`fixed bottom-6 right-6 z-50 inline-flex items-center gap-3 rounded-2xl bg-[var(--color-brand)] px-4 py-3 text-white shadow-[0_16px_40px_rgb(37_99_235_/_0.28)] transition-all hover:shadow-[0_18px_48px_rgb(37_99_235_/_0.35)] active:scale-[.97] ${open ? 'md:pointer-events-none md:scale-95 md:opacity-0' : ''}`}
      >
        <div className="relative">
          <ShoppingBag className="size-5" />
          {lines.length ? (
            <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[var(--color-brand)] shadow">
              {lines.length}
            </span>
          ) : null}
        </div>
        <div className="operational-cart-button-label text-left">
          <p className="text-xs font-bold leading-none">{copy('Cart')}</p>
          <p className="mt-1 text-[11px] opacity-90">{money(total, locale)}</p>
        </div>
      </button>
      <div
        role="dialog"
        aria-label={copy('Cart')}
        className={`operational-cart-panel fixed bottom-6 right-6 z-50 max-h-[calc(100dvh-48px)] w-[420px] max-w-[calc(100vw-48px)] origin-bottom-right flex-col overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-background)] shadow-[0_24px_70px_rgb(15_23_42_/_0.22)] transition-all duration-200 ease-out ${open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-4 scale-95 opacity-0'}`}
      >
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">{copy('Cart')}</h2>
              <p className="text-xs text-[var(--color-text-muted)]">{countLabel}</p>
            </div>
            <button
              type="button"
              aria-label={copy('Close')}
              onClick={() => onOpenChange(false)}
              className="rounded-xl p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
            >
              <X className="size-[18px]" />
            </button>
          </div>
        </div>
        {panel}
      </div>
      <div
        onClick={() => onOpenChange(false)}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        role="dialog"
        aria-label={copy('Cart')}
        className={`fixed inset-x-0 bottom-0 z-50 h-[86dvh] overflow-hidden rounded-t-[28px] border-t border-[var(--color-border)] bg-[var(--color-background)] shadow-[0_-24px_80px_rgb(15_23_42_/_0.25)] transition-transform duration-300 ease-out md:hidden ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">{copy('Cart')}</h2>
                <p className="text-xs text-[var(--color-text-muted)]">{countLabel}</p>
              </div>
              <button
                type="button"
                aria-label={copy('Close')}
                onClick={() => onOpenChange(false)}
                className="rounded-xl p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
              >
                <X className="size-[18px]" />
              </button>
            </div>
          </div>
          {panel}
        </div>
      </div>
    </>
  );
}

export function ReferenceCartPanel({
  lines,
  total,
  gross,
  discountAmount,
  discountLabel,
  taxAmount,
  taxLabel,
  isEstimate,
  isTaxPreviewLoading,
  isTaxPreviewUnavailable,
  locale,
  customer,
  memberNumber,
  pointBalance,
  isPointBalanceLoading,
  onChooseCustomer,
  onQuantity,
  onEdit,
  onRemove,
  onCheckout,
}: {
  lines: readonly CartDisplayLine[];
  total: string;
  gross: string;
  discountAmount: string;
  discountLabel: string;
  taxAmount: string;
  taxLabel: string;
  isEstimate: boolean;
  isTaxPreviewLoading: boolean;
  isTaxPreviewUnavailable: boolean;
  locale: string;
  customer: SaleCustomer | null;
  memberNumber: string | null;
  pointBalance: string | null;
  isPointBalanceLoading: boolean;
  onChooseCustomer: () => void;
  onQuantity: (line: CartDisplayLine, quantity: string) => void;
  onEdit: (line: CartDisplayLine, options?: { addUnit?: boolean }) => void;
  onRemove: (line: CartDisplayLine) => void;
  onCheckout: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const status = customerStatus(customer);
  const hasDiscount = !createDecimal(discountAmount).equals(createDecimal('0'));
  const hasTax = !createDecimal(taxAmount).equals(createDecimal('0'));
  const increment = (line: CartDisplayLine, direction: 'up' | 'down') => {
    const next =
      direction === 'up'
        ? createDecimal(line.quantity).plus(createDecimal('1'))
        : createDecimal(line.quantity).minus(createDecimal('1'));
    if (next.lessThan(createDecimal('1'))) return;
    // A local line that carries additions never gains a unit by copying: the new unit is
    // configured in the editor, so a required addition cannot be satisfied silently.
    if (direction === 'up' && line.editable && (line.additions?.length || line.units?.length)) {
      onEdit(line, { addUnit: true });
      return;
    }
    onQuantity(line, next.toFixed(4));
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-background)]">
      <div className="shrink-0 space-y-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <button
          type="button"
          aria-label={copy('Choose customer')}
          onClick={onChooseCustomer}
          className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/45 px-3 py-2.5 text-left transition-colors hover:border-[var(--color-brand)]/35 hover:bg-[var(--color-brand)]/5"
        >
          <div className="grid size-8 place-items-center rounded-xl bg-[var(--color-background)] text-[var(--color-text-muted)]">
            <User className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-xs font-semibold">
                {customer ? customer.name : copy('Choose customer')}
              </p>
              {status ? (
                <Badge variant={status.variant} className="shrink-0 px-2 py-0 text-[10px]">
                  {copy(status.label)}
                </Badge>
              ) : null}
              {customer?.type === 'MEMBER' && memberNumber ? (
                <Badge variant="outline" className="shrink-0 px-2 py-0 text-[10px]">
                  {memberNumber}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
              {customer?.type === 'MEMBER' && isPointBalanceLoading
                ? copy('Loading loyalty points…')
                : customer?.type === 'MEMBER' && pointBalance !== null
                  ? `${copy('Loyalty points')}: ${pointQuantity(pointBalance, locale)}`
                  : (customerDisplayDetail(customer) ??
                    copy('Name and WhatsApp number are both required.'))}
            </p>
          </div>
          <ChevronDown className="size-4 shrink-0 text-[var(--color-text-muted)]" />
        </button>
      </div>
      <div
        className={`min-h-0 border-y border-[var(--color-border)] bg-[var(--color-surface-muted)]/20 ${lines.length ? 'flex-1 overflow-y-auto' : 'shrink-0'}`}
      >
        {lines.length ? (
          <div className="space-y-2 overflow-y-auto p-3">
            {lines.map((line) => {
              const discountPercentage = lineDiscountPercentage(line);
              return (
                <div
                  key={line.id}
                  className="pos-cart-line-enter rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {line.itemNameSnapshot}
                      </p>
                      <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                        {money(line.effectiveUnitPrice, locale)}
                        {line.variantNameSnapshot ? `, ${line.variantNameSnapshot}` : ''}
                        {line.promotion ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`${copy('Promotion')}: ${line.promotion.name}`}
                            title={[
                              line.promotion.name,
                              line.promotion.effectiveFrom
                                ? `${copy('Start')}: ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(line.promotion.effectiveFrom))}`
                                : null,
                              line.promotion.effectiveUntil
                                ? `${copy('End')}: ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(line.promotion.effectiveUntil))}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                            className="ml-1 inline-flex size-4 align-text-bottom text-[var(--color-text-muted)]"
                          >
                            <Info className="size-3" />
                          </Button>
                        ) : null}
                        {line.itemTypeSnapshot === 'SERVICE' ? (
                          <span className="ml-1 font-semibold text-cyan-700">
                            {copy('Service')}
                          </span>
                        ) : null}
                      </div>
                      {line.soldByName ? (
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                          {copy('Sold by')} {line.soldByName}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {line.editable ? (
                        <button
                          type="button"
                          aria-label={`${copy('Edit item')} ${line.itemNameSnapshot}`}
                          onClick={() => onEdit(line)}
                          className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`${copy('Remove')} ${line.itemNameSnapshot}`}
                        onClick={() => onRemove(line)}
                        className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <CartLineBreakdown
                    line={line}
                    heading={copy('Additional items')}
                    baseLabel={copy('Item price')}
                    unitLabel={(index) => `${copy('Unit')} ${index}`}
                    format={(amount) => money(amount, locale)}
                    formatQuantity={quantity}
                    performedByLabel={copy('Performed by')}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="inline-grid grid-cols-[36px_48px_36px] items-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] shadow-[inset_0_1px_0_rgb(15_23_42_/_0.02)]">
                      <button
                        type="button"
                        aria-label={`${copy('Decrease quantity')} ${line.itemNameSnapshot}`}
                        onClick={() => increment(line, 'down')}
                        disabled={createDecimal(line.quantity).lessThanOrEqualTo(
                          createDecimal('1'),
                        )}
                        className="flex h-9 items-center justify-center border-r border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] active:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--color-text-muted)]"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <output
                        aria-label={`${copy('Quantity')} ${line.itemNameSnapshot}`}
                        className="flex h-9 w-12 items-center justify-center text-xs font-bold tabular-nums text-[var(--color-text)]"
                      >
                        {quantity(line.quantity)}
                      </output>
                      <button
                        type="button"
                        aria-label={`${copy('Increase quantity')} ${line.itemNameSnapshot}`}
                        onClick={() => increment(line, 'up')}
                        className="flex h-9 items-center justify-center border-l border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] active:bg-[var(--color-surface-muted)]"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-[var(--color-brand)]">
                      {money(line.totalAmount, locale)}
                    </p>
                  </div>
                  {isPositiveDecimal(line.lineDiscountAmount) ? (
                    <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                      <span className="text-[var(--color-text-muted)]">
                        {copy('Item discount')}
                        {discountPercentage ? ` (${discountPercentage}%)` : ''}
                      </span>
                      <span className="font-semibold text-[var(--color-danger)]">
                        −{money(line.lineDiscountAmount, locale)}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <ShoppingBag className="size-[22px]" />
            </div>
            <p className="text-sm font-semibold">{copy('Cart is empty')}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {copy('Select products or services from the catalog.')}
            </p>
          </div>
        )}
      </div>
      <div className="shrink-0 bg-[var(--color-background)] p-4">
        <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">
              {copy(isEstimate ? 'Estimated subtotal' : 'Subtotal')}
            </span>
            <span className="font-medium">{money(gross, locale)}</span>
          </div>
          {hasDiscount ? (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">{discountLabel}</span>
              <span className="font-medium text-[var(--color-danger)]">
                −{money(discountAmount, locale)}
              </span>
            </div>
          ) : null}
          {hasTax || isTaxPreviewLoading || isTaxPreviewUnavailable ? (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">{taxLabel}</span>
              <span className="font-medium">
                {isTaxPreviewLoading
                  ? copy('Calculating…')
                  : isTaxPreviewUnavailable
                    ? copy('Not available')
                    : money(taxAmount, locale)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
            <span className="text-sm font-bold">
              {copy(isEstimate ? 'Estimated total' : 'Total')}
            </span>
            <span
              key={total}
              className="pos-value-updated text-lg font-bold tabular-nums text-[var(--color-brand)]"
            >
              {money(total, locale)}
            </span>
          </div>
          {isEstimate && lines.length ? (
            <p className="text-[11px] leading-4 text-[var(--color-text-muted)]">
              {copy('Tax and promotions are finalized when the transaction is created.')}
            </p>
          ) : null}
          <Button
            fullWidth
            disabled={!lines.length}
            onClick={onCheckout}
            leftIcon={<CreditCard className="size-3.5" />}
          >
            {copy('Checkout')}
          </Button>
        </div>
      </div>
    </div>
  );
}

