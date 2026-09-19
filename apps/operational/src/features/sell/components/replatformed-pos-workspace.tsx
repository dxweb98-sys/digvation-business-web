import { useAuth } from '@digvation/pos-auth';
import { createDecimal, formatMoney } from '@digvation/pos-money';
import { useRuntime } from '@digvation/pos-runtime';
import {
  DAlert,
  DBadge as Badge,
  DButton,
  DButton as Button,
  DCombobox as Combobox,
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
import { DTabs, DTabsContent, DTabsList, DTabsTrigger, DTextarea } from '@digvation/ui';
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
  Minus,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  ShoppingBag,
  Trash2,
  User,
  UserPlus,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import {
  QUEUE_REFRESH_INTERVAL_MS,
  liveQueryPolicy,
} from '../../../app/data/operational-cache-policy';
import {
  operationalCopy,
  resolveOperationalLocale,
  useOperationalLocalization,
} from '../../../app/localization/operational-localization';
import { useCashierSession } from '../../../app/providers/cashier-session-provider';
import { cashierTransactionKeys } from '../cashier-transaction-keys';
import { cashierTransactionErrorMessage } from '../cashier-transaction-errors';
import type { CartDisplayLine } from '../cart-draft';
import {
  createCashierTransactionAdapter,
  isLocalCashierDemoEnabled,
} from '../cashier-transaction-adapter-factory';
import { hasStartableQueuedWork } from '../queued-sale-work';
import {
  employeeDisplayName,
  formatServiceDuration,
  lineDiscountPercentage,
  saleDiscountRows,
  discountPresentation,
  lineDiscountRows,
  saleSettlement,
  saleTaxLabel,
  transactionDiscountLabel,
} from '../sale-presentation';
import type {
  CatalogItem,
  Employee,
  Payment,
  PaymentMethod,
  PaymentRoute,
  Sale,
  SaleCustomer,
  SaleCustomerSelection,
  SaleLine,
} from '../cashier-transaction.types';
import type { CatalogItemTypeFilter } from '../use-selling-catalog';
import type { useCashierTransactionWorkspace } from '../use-cashier-transaction-workspace';

import { normalizeCurrencyPresentationInput, PosCurrencyInput } from './pos-controls';
import {
  SaleDetailHeader,
  SaleDetailSection,
  SaleFinancialSummary,
  SaleLineItem,
  SaleLineItemList,
  SalePaymentList,
  StatusPill,
} from './sale-detail-presentation';
import { SaleAdjustmentControls } from './sale-adjustment-controls';
import { SaleLineTaskDialog } from './sale-line-task-dialog';
import {
  ServicePerformersDialog,
  serviceWorkUnitAllocations,
  serviceWorkUnitCount,
} from './service-performers-dialog';
import {
  formatPercent,
  formatUnitRanges,
  groupAllocations,
  resolveAllocation,
  type PerformerAllocation,
  type ServiceLineWorkPlan,
} from '../service-performer-allocation';
import type { VariantPickerState } from './variant-picker';
import './replatformed-pos-workspace.css';

type Workspace = ReturnType<typeof useCashierTransactionWorkspace>;
type QueueStatus = 'QUEUED' | 'PROGRESS' | 'COMPLETED' | 'CANCELED';
type FulfillmentDestination = 'QUEUE' | 'START_PROCESS';
interface QueuedSaleEntry {
  saleId: string;
  sellingLocationId: string;
  saleCreatedAt: string;
}

const QUEUED_SALE_IDS_KEY = 'digvation-pos-demo-queued-sale-ids';
const CANCELED_SALE_REASONS_KEY = 'digvation-pos-demo-canceled-sale-reasons';

function copyFor(value: string, locale: string): string {
  return operationalCopy(value, resolveOperationalLocale(locale));
}

function readQueuedSaleEntries(): QueuedSaleEntry[] {
  try {
    const raw = window.sessionStorage.getItem(QUEUED_SALE_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is QueuedSaleEntry =>
            typeof value === 'object' &&
            value !== null &&
            typeof value.saleId === 'string' &&
            typeof value.sellingLocationId === 'string' &&
            typeof value.saleCreatedAt === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function writeQueuedSaleEntries(entries: readonly QueuedSaleEntry[]): void {
  try {
    window.sessionStorage.setItem(QUEUED_SALE_IDS_KEY, JSON.stringify(entries));
  } catch {
    // Queue presentation state remains available for the current session when storage is unavailable.
  }
}

function readCancellationReasons(): Record<string, string> {
  try {
    const raw = window.sessionStorage.getItem(CANCELED_SALE_REASONS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {};
  } catch {
    return {};
  }
}

function writeCancellationReason(saleId: string, reason: string): void {
  try {
    window.sessionStorage.setItem(
      CANCELED_SALE_REASONS_KEY,
      JSON.stringify({ ...readCancellationReasons(), [saleId]: reason }),
    );
  } catch {
    // This local/demo presentation metadata is optional when session storage is unavailable.
  }
}

const statusMeta: Record<
  QueueStatus,
  { value: string; icon: ReactNode; tone: string; soft: string }
> = {
  QUEUED: {
    value: 'QUEUED',
    icon: <Clock className="size-3.75" />,
    tone: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    soft: 'bg-[var(--color-warning)]/[.045]',
  },
  PROGRESS: {
    value: 'IN_PROGRESS',
    icon: <PlayCircle className="size-3.75" />,
    tone: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]',
    soft: 'bg-[var(--color-brand)]/[.045]',
  },
  COMPLETED: {
    value: 'COMPLETED',
    icon: <CheckCircle2 className="size-3.75" />,
    tone: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
    soft: 'bg-[var(--color-success)]/[.045]',
  },
  CANCELED: {
    value: 'CANCELED',
    icon: <XCircle className="size-3.75" />,
    tone: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
    soft: 'bg-[var(--color-danger)]/[.045]',
  },
};

function money(amount: string, locale: string) {
  return formatMoney(amount, 'IDR', locale, 0);
}

function formatDurationMinutes(minutes: number | null | undefined, locale: string): string | null {
  return formatServiceDuration(minutes, {
    hour: copyFor('hour-short', locale),
    minute: copyFor('minute-short', locale),
  });
}

function quantity(value: string) {
  const normalized = value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  return normalized === '-0' ? '0' : normalized;
}

function transactionNumber(sale: Pick<Sale, 'id' | 'saleNumber'>, locale: string) {
  // Prefer the authoritative sale number; fall back to the short id for sales without one.
  if (sale.saleNumber) return sale.saleNumber;
  return sale.id.startsWith('SALE-DEMO-')
    ? sale.id
    : `${copyFor('Transaction', locale)} ${sale.id.slice(0, 8)}`;
}

/**
 * The Sale owns its customer identity, so presentation reads it straight from
 * the Sale. A Sale captured before the customer contract carries no identity:
 * it stays neutral and is never shown as a general or anonymous customer.
 */
function customerDisplayName(customer: SaleCustomer | null, locale: string): string {
  return customer && customer.name.trim()
    ? customer.name
    : copyFor('Customer data is not available', locale);
}

function customerDisplayDetail(customer: SaleCustomer | null): string | null {
  return customer && customer.phoneE164.trim() ? customer.phoneE164 : null;
}

function customerStatus(customer: SaleCustomer | null): {
  label: 'Member' | 'Non-member';
  variant: 'primary' | 'outline';
} | null {
  if (!customer) return null;
  return customer.type === 'MEMBER'
    ? { label: 'Member', variant: 'primary' }
    : { label: 'Non-member', variant: 'outline' };
}

interface PerformerCredit {
  employeeId: string;
  name: string;
  /** Shown only when the split was set by hand; an even split needs no numbers. */
  percent: string | null;
}

interface PerformerGroup {
  /** Units this setting covers, e.g. "1–2, 4–7"; null when it covers the whole line. */
  units: string | null;
  performers: PerformerCredit[];
}

/**
 * Who performs a service line. Units with an identical assignment collapse
 * into one group, so a line reads as one setting unless units really differ.
 */
function servicePerformerSummary(
  line: SaleLine,
  employees: readonly Employee[],
  locale: string,
): { unitCount: number; groups: PerformerGroup[] } {
  const units = serviceWorkUnitAllocations(line);
  const credits = (allocation: PerformerAllocation): PerformerCredit[] => {
    const { shares } = resolveAllocation(allocation);
    const custom = shares.some((share) => share.manual);
    return shares.map((share) => ({
      employeeId: share.employeeId,
      name: employeeDisplayName(
        line,
        share.employeeId,
        employees,
        copyFor('Employee unavailable', locale),
      ),
      percent: custom ? `${formatPercent(share.basisPoints, locale)}%` : null,
    }));
  };
  const grouped = groupAllocations(units);
  return {
    unitCount: units.length,
    groups: grouped.map((group) => ({
      units: grouped.length > 1 ? formatUnitRanges(group.unitNumbers) : null,
      performers: credits(group.allocation),
    })),
  };
}

/** Distinct settings listed before the rest folds away, keeping long lines scannable. */
const VISIBLE_PERFORMER_GROUPS = 3;

function PerformerNames({ performers }: { performers: readonly PerformerCredit[] }) {
  const { copy } = useOperationalLocalization();
  if (!performers.length)
    return (
      <span className="font-medium text-[var(--color-warning)]">{copy('No employee yet')}</span>
    );
  return (
    // Bold name + muted share already separate people; a wrapped name keeps its
    // share right after its last word.
    <ul className="m-0 flex min-w-0 list-none flex-wrap gap-x-3 gap-y-0.5 p-0">
      {performers.map((performer) => (
        <li key={performer.employeeId} className="min-w-0 break-words">
          <span className="font-medium text-[var(--color-text)]">{performer.name}</span>
          {performer.percent ? (
            <span className="ml-1 whitespace-nowrap tabular-nums text-[var(--color-text-muted)]">
              {performer.percent}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * The performers of one service line as a compact, self-contained block: who,
 * which services it covers, and the one action that changes it.
 */
function ServicePerformerSummary({
  itemName,
  summary,
  needsAttention,
  editable,
  disabled,
  onEdit,
}: {
  itemName: string;
  summary: ReturnType<typeof servicePerformerSummary>;
  needsAttention: boolean;
  editable: boolean;
  disabled: boolean;
  onEdit: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const [expanded, setExpanded] = useState(false);
  const { unitCount, groups } = summary;
  const varied = groups.length > 1;
  const foldable = groups.length > VISIBLE_PERFORMER_GROUPS;
  const shown = foldable && !expanded ? groups.slice(0, VISIBLE_PERFORMER_GROUPS - 1) : groups;
  const hiddenCount = groups.length - shown.length;
  const scope = varied
    ? copy('Different for each service')
    : unitCount > 1
      ? `${copy('Applies to')} ${unitCount} ${copy('services')}`
      : null;

  return (
    <section
      aria-label={`${copy('Performed by')}: ${itemName}`}
      className={`mt-2 rounded-[var(--radius-control)] px-3 py-2 text-xs ${
        needsAttention
          ? 'bg-[var(--color-warning)]/10 ring-1 ring-inset ring-[var(--color-warning)]/25'
          : 'bg-[var(--color-surface-muted)]/70'
      }`}
    >
      <div className="flex min-h-7 items-center justify-between gap-2">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <span className="font-semibold text-[var(--color-text)]">{copy('Performed by')}</span>
          {scope ? <span className="text-[var(--color-text-muted)]">· {scope}</span> : null}
        </p>
        {editable ? (
          <DButton
            size="sm"
            variant={needsAttention ? 'outline' : 'ghost'}
            disabled={disabled}
            leftIcon={
              needsAttention ? <UserPlus className="size-3.5" /> : <Pencil className="size-3.5" />
            }
            aria-label={`${copy(needsAttention ? 'Choose employee' : 'Change employee')}: ${itemName}`}
            className="-mr-1.5 h-7 shrink-0 px-2 text-xs"
            onClick={onEdit}
          >
            {copy(needsAttention ? 'Choose employee' : 'Edit employee')}
          </DButton>
        ) : null}
      </div>

      {varied ? (
        <>
          <dl className="mt-0.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
            {shown.map((group, index) => (
              <div
                key={group.units}
                className={`col-span-2 grid grid-cols-subgrid py-1.5 ${
                  index > 0 ? 'border-t border-[var(--color-border)]' : ''
                }`}
              >
                <dt className="max-w-[7.5rem] break-words tabular-nums text-[var(--color-text-muted)]">
                  {copy('Service')} {group.units}
                </dt>
                <dd className="m-0 min-w-0">
                  <PerformerNames performers={group.performers} />
                </dd>
              </div>
            ))}
          </dl>
          {foldable ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
              className="inline-flex min-h-7 items-center gap-1 rounded-md font-semibold text-[var(--color-brand)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/30"
            >
              {expanded ? copy('Show less') : `${copy('Show')} ${hiddenCount} ${copy('more')}`}
              <ChevronDown
                className={`size-3.5 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          ) : null}
        </>
      ) : (
        <div className="pb-0.5">
          <PerformerNames performers={groups[0]?.performers ?? []} />
        </div>
      )}
    </section>
  );
}

function queueStatus(sale: Sale): QueueStatus | null {
  if (sale.status === 'FINALIZED') return 'COMPLETED';
  if (sale.status === 'VOIDED') return 'CANCELED';
  if (sale.operationalState === 'IN_PROGRESS') return 'PROGRESS';
  if (sale.operationalState === 'QUEUED') return 'QUEUED';
  return null;
}

function isPositiveDecimal(value: string) {
  try {
    return createDecimal(value).greaterThan(createDecimal('0'));
  } catch {
    return false;
  }
}

function useCachedPaymentRoutes(): { routes: PaymentRoute[]; isPending: boolean } {
  const runtime = useRuntime();
  const { selectedLocationId } = useCashierSession();
  const query = useQuery({
    queryKey: cashierTransactionKeys.paymentRoutes(selectedLocationId ?? '', runtime.currency),
    queryFn: async () => ({ items: [] as PaymentRoute[], limit: 0, offset: 0 }),
    enabled: false,
  });
  return {
    routes: (query.data?.items ?? []).filter((route) => route.status === 'ACTIVE'),
    isPending: query.data === undefined,
  };
}

function employeeAssignmentIssues(line: SaleLine, locale: string): string[] {
  const issues: string[] = [];
  if (
    line.employeeAssignmentModeSnapshot === 'REQUIRED' &&
    !line.participations.some((participation) => participation.assigned)
  ) {
    issues.push(`${line.itemNameSnapshot}: ${copyFor('Select an employee.', locale)}`);
  }
  if (line.allowEmployeeContributionSnapshot) {
    const shares = line.participations.filter(
      (participation) => participation.assigned && participation.shareRate !== null,
    );
    const total = shares.reduce(
      (sum, participation) => sum.plus(createDecimal(participation.shareRate ?? '0')),
      createDecimal('0'),
    );
    if (!shares.length || !total.equals(createDecimal('1'))) {
      issues.push(
        `${line.itemNameSnapshot}: ${copyFor('Employee contribution must total 100%.', locale)}`,
      );
    }
  }
  return issues;
}

function workflowIssues(sale: Sale, locale: string) {
  const issues: string[] = [];
  const active = sale.lines.filter((line) => line.removedAt === null);
  if (!active.length) issues.push(copyFor('Add at least one item.', locale));

  const succeeded = sale.payments
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum.plus(createDecimal(payment.appliedAmount)), createDecimal('0'));
  if (!succeeded.equals(createDecimal(sale.totalAmount))) {
    issues.push(copyFor('Payments must match the transaction total.', locale));
  }
  if (sale.payments.some((payment) => payment.status === 'PENDING')) {
    issues.push(copyFor('Resolve pending payments.', locale));
  }

  for (const line of active) {
    if (!isPositiveDecimal(line.quantity))
      issues.push(
        `${line.itemNameSnapshot}: ${copyFor('Quantity must be greater than zero.', locale)}`,
      );
    if (!isPositiveDecimal(line.effectiveUnitPrice))
      issues.push(`${line.itemNameSnapshot}: ${copyFor('Price is not available.', locale)}`);
    const requiresTrackedServiceAssignment =
      line.itemTypeSnapshot === 'SERVICE' && line.fulfillmentBehaviorSnapshot === 'TRACKED';
    if (!requiresTrackedServiceAssignment) continue;

    const plannedUnits = line.workUnits?.length ?? 0;
    if (plannedUnits > 0 && plannedUnits !== serviceWorkUnitCount(line)) {
      issues.push(
        `${line.itemNameSnapshot}: ${copyFor('Every work unit needs at least one employee.', locale)}`,
      );
      continue;
    }

    issues.push(...employeeAssignmentIssues(line, locale));
  }
  return issues;
}

interface WorkflowIssueGroup {
  id: string;
  label: string;
  issues: string[];
}

function groupWorkflowIssues(
  sale: Sale,
  issues: readonly string[],
  locale: string,
): WorkflowIssueGroup[] {
  const activeLines = sale.lines.filter((line) => line.removedAt === null);
  const groups = new Map<string, WorkflowIssueGroup>();

  for (const issue of issues) {
    const line = activeLines.find((candidate) =>
      issue.startsWith(`${candidate.itemNameSnapshot}:`),
    );
    const id = line?.id ?? 'transaction';
    const label = line?.itemNameSnapshot ?? copyFor('Transaction', locale);
    const detail = line ? issue.slice(`${line.itemNameSnapshot}:`.length).trim() : issue;
    const group = groups.get(id) ?? { id, label, issues: [] };
    group.issues.push(detail);
    groups.set(id, group);
  }

  return [...groups.values()];
}

function processIssues(
  sale: Sale | null,
  lines: readonly CartDisplayLine[],
  locale: string,
): string[] {
  if (!lines.length) return [copyFor('Add at least one item.', locale)];
  if (sale && sale.status !== 'OPEN')
    return [copyFor('Only active transactions can be processed.', locale)];

  return lines.flatMap((line) => {
    if (!isPositiveDecimal(line.quantity))
      return [
        `${line.itemNameSnapshot}: ${copyFor('Quantity must be greater than zero.', locale)}`,
      ];
    if (!isPositiveDecimal(line.effectiveUnitPrice))
      return [`${line.itemNameSnapshot}: ${copyFor('Price is not available.', locale)}`];
    return [];
  });
}

function hasSuccessfulCheckout(sale: Sale): boolean {
  if (sale.payments.some((payment) => payment.status === 'PENDING')) return false;
  const settledAmount = sale.payments
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum.plus(createDecimal(payment.appliedAmount)), createDecimal('0'));
  return settledAmount.equals(createDecimal(sale.totalAmount));
}

function successfulPayments(sale: Sale) {
  return sale.payments.filter((payment) => payment.status === 'SUCCEEDED');
}

function financialSummary(sale: Sale) {
  const totalPaid = successfulPayments(sale).reduce(
    (sum, payment) => sum.plus(createDecimal(payment.appliedAmount)),
    createDecimal('0'),
  );
  const balance = createDecimal(sale.totalAmount).minus(totalPaid);
  return {
    totalPaid: totalPaid.toFixed(4),
    balanceDue: balance.greaterThan(createDecimal('0')) ? balance.toFixed(4) : '0.0000',
  };
}

function hasSuccessfulPayment(sale: Sale): boolean {
  return successfulPayments(sale).some((payment) =>
    createDecimal(payment.appliedAmount).greaterThan(createDecimal('0')),
  );
}

export function ReplatformedPosWorkspace({ workspace }: { workspace: Workspace }) {
  const runtime = useRuntime();
  const { session, authPort } = useAuth();
  const { showToast } = useToast();
  const { copy } = useOperationalLocalization();
  const isLocalDemo = isLocalCashierDemoEnabled();
  const adapter = useMemo(
    () => createCashierTransactionAdapter(runtime, authPort.getAccessToken?.bind(authPort)),
    [authPort, runtime],
  );
  // The queue is shared operational reality, so it polls — but only while this
  // tab is focused, and it keeps serving the last answer while refetching.
  const transactionsQuery = useQuery({
    queryKey: cashierTransactionKeys.sales(),
    queryFn: ({ signal }) => adapter.listSales(signal),
    ...liveQueryPolicy,
    refetchInterval: QUEUE_REFRESH_INTERVAL_MS,
  });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [queueTab, setQueueTab] = useState<QueueStatus>('QUEUED');
  const [queuedSaleEntries, setQueuedSaleEntries] = useState<QueuedSaleEntry[]>(() =>
    isLocalDemo ? readQueuedSaleEntries() : [],
  );
  const [queueIssues] = useState<Record<string, string[]>>({});
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueDetail, setQueueDetail] = useState<Sale | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellationReasons, setCancellationReasons] = useState<Record<string, string>>(() =>
    isLocalDemo ? readCancellationReasons() : {},
  );
  const [adjustmentTarget, setAdjustmentTarget] = useState<Sale | null>(null);
  const [queuePaymentTarget, setQueuePaymentTarget] = useState<Sale | null>(null);
  const [queuePaymentAmount, setQueuePaymentAmount] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payNow, setPayNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [provider, setProvider] = useState('');
  const [tender, setTender] = useState('');
  const [completionConfirmationTarget, setCompletionConfirmationTarget] = useState<Sale | null>(
    null,
  );
  const [performerTarget, setPerformerTarget] = useState<{
    sale: Sale;
    line: SaleLine;
  } | null>(null);
  const [isSavingPerformers, setSavingPerformers] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [isSendingReceipt, setSendingReceipt] = useState(false);

  const sale = workspace.viewModel.sale;
  const lines = workspace.cart.lines;
  const total = workspace.cart.totalAmount;
  const activeCustomer = workspace.customer;

  const displayedQueueDetail =
    receiptSaleId && sale?.id === receiptSaleId && hasSuccessfulPayment(sale) ? sale : queueDetail;
  const displayedAdjustmentTarget =
    adjustmentTarget && sale?.id === adjustmentTarget.id ? sale : adjustmentTarget;
  const displayedQueuePaymentTarget =
    queuePaymentTarget && sale?.id === queuePaymentTarget.id ? sale : queuePaymentTarget;

  const categories = useMemo(
    () =>
      workspace.categories.filter((category) =>
        workspace.items.some((item) => item.categoryId === category.id),
      ),
    [workspace.categories, workspace.items],
  );
  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return workspace.items.filter(
      (item) =>
        (!selectedCategory || item.categoryId === selectedCategory) &&
        (!needle || `${item.name} ${item.code}`.toLowerCase().includes(needle)),
    );
  }, [search, selectedCategory, workspace.items]);
  const groups = useMemo(() => {
    const locationRecords = (transactionsQuery.data?.items ?? []).filter(
      (record) => record.sellingLocationId === workspace.selectedLocationId,
    );
    const records = isLocalDemo
      ? locationRecords.filter((record) =>
          queuedSaleEntries.some(
            (entry) => entry.saleId === record.id && entry.saleCreatedAt === record.createdAt,
          ),
        )
      : locationRecords;
    return {
      QUEUED: records.filter((record) => queueStatus(record) === 'QUEUED'),
      PROGRESS: records.filter((record) => queueStatus(record) === 'PROGRESS'),
      COMPLETED: records.filter((record) => queueStatus(record) === 'COMPLETED'),
      CANCELED: records.filter((record) => queueStatus(record) === 'CANCELED'),
    };
  }, [isLocalDemo, queuedSaleEntries, transactionsQuery.data, workspace.selectedLocationId]);

  const selectType = (type: CatalogItemTypeFilter) => {
    workspace.setItemType(type);
    setSelectedCategory('');
  };

  const openCheckout = async () => {
    // A transaction belongs to a customer. Without one there is nothing to
    // check out, so the selector is opened instead of creating a Sale.
    if (!activeCustomer) {
      showToast({
        title: copy('Choose the customer first'),
        description: copy(
          'A transaction belongs to a customer. Fill in the name and WhatsApp number, or choose a member.',
        ),
        variant: 'warning',
      });
      setCartOpen(false);
      setCustomerPickerOpen(true);
      return;
    }
    const issues = processIssues(sale, lines, workspace.locale);
    if (issues.length) {
      showToast({
        title: copy('Cart is not ready for payment'),
        description: issues[0],
        variant: 'warning',
      });
      return;
    }
    if (workspace.viewModel.synchronization !== 'CLEAN') {
      showToast({
        title: copy('Wait for changes to finish'),
        description: copy('The cart is still syncing the latest changes.'),
        variant: 'warning',
      });
      return;
    }

    let checkoutTotal = total;
    if (workspace.cart.isLocalDraft) {
      try {
        const committed = await workspace.commitDraft();
        checkoutTotal = committed.totalAmount;
      } catch (error) {
        showToast({
          title: copy('Could not create transaction'),
          description: `${cashierTransactionErrorMessage(error)} ${copy('The cart is unchanged. Check the configuration or connection and try again.')}`,
          variant: 'danger',
        });
        return;
      }
    }

    setTender(normalizeCurrencyPresentationInput(checkoutTotal));
    setPayNow(true);
    setPaymentMethod('CASH');
    setProvider('');
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  /**
   * Requests receipt delivery for a captured transaction. Delivery is separate
   * from the transaction: a provider that is absent or failing is reported as a
   * delivery outcome and never touches the Sale, its payment or its queue state.
   */
  const sendReceipt = async (target: Sale) => {
    setSendingReceipt(true);
    try {
      await adapter.requestReceiptDelivery(target.id, 'WHATSAPP');
      showToast({
        title: copy('Send via WhatsApp'),
        description: transactionNumber(target, workspace.locale),
      });
    } catch (error) {
      showToast({
        title: copy('Not available yet'),
        description: cashierTransactionErrorMessage(error),
        variant: 'warning',
      });
    } finally {
      setSendingReceipt(false);
    }
  };

  const commitCheckoutToQueue = (
    completedSale: Sale,
    wasPaid: boolean,
    destination: FulfillmentDestination,
  ) => {
    if (isLocalDemo) {
      const committedEntry: QueuedSaleEntry = {
        saleId: completedSale.id,
        sellingLocationId: completedSale.sellingLocationId,
        saleCreatedAt: completedSale.createdAt,
      };
      const nextQueuedSaleEntries = queuedSaleEntries.some(
        (entry) =>
          entry.saleId === committedEntry.saleId &&
          entry.saleCreatedAt === committedEntry.saleCreatedAt,
      )
        ? queuedSaleEntries
        : [
            ...queuedSaleEntries.filter((entry) => entry.saleId !== committedEntry.saleId),
            committedEntry,
          ];
      writeQueuedSaleEntries(nextQueuedSaleEntries);
      setQueuedSaleEntries(nextQueuedSaleEntries);
    }
    setQueueTab('QUEUED');
    setQueueOpen(true);
    setCartOpen(false);
    setCheckoutOpen(false);

    workspace.clearProcessedDraft();

    if (hasSuccessfulPayment(completedSale) && destination === 'QUEUE') {
      setReceiptSaleId(completedSale.id);
      setQueueDetail(completedSale);
    } else {
      setReceiptSaleId(null);
      setQueueDetail(null);
    }

    showToast({
      title: wasPaid ? copy('Payment successful') : copy('Transaction created'),
      description:
        destination === 'START_PROCESS'
          ? `${transactionNumber(completedSale, workspace.locale)} ${copy('Added to queue and ready to start.')}`
          : wasPaid
            ? `${transactionNumber(completedSale, workspace.locale)} ${copy('Paid and added to queue.')}`
            : `${transactionNumber(completedSale, workspace.locale)} ${copy('Added to queue. Payment has not been received.')}`,
      variant: 'success',
    });
  };

  const startQueuedWork = async (transaction: Sale) => {
    const line = transaction.lines.find(
      (candidate) =>
        candidate.removedAt === null &&
        candidate.fulfillmentBehaviorSnapshot === 'TRACKED' &&
        candidate.fulfillment?.status === 'WAITING',
    );
    if (!line) {
      showToast({
        title: copy('No work can be started'),
        description: copy('This transaction has no services waiting to be worked on.'),
        variant: 'warning',
      });
      return false;
    }
    try {
      const started =
        transaction.operationalState === 'IN_PROGRESS'
          ? transaction
          : await workspace.startSaleWork(transaction);
      await workspace.startQueuedFulfillment(started, line);
      setQueueTab('PROGRESS');
      showToast({
        title: copy('Work started'),
        description: `${transactionNumber(transaction, workspace.locale)} ${copy('is now being worked on.')}`,
        variant: 'success',
      });
      return true;
    } catch {
      showToast({
        title: copy('Could not start work'),
        description: copy('The transaction remains in the queue.'),
        variant: 'danger',
      });
      return false;
    }
  };

  const savePerformers = async (
    target: { sale: Sale; line: SaleLine },
    plans: ServiceLineWorkPlan[],
  ) => {
    setSavingPerformers(true);
    try {
      const updated = await workspace.setQueuedWorkUnits(target.sale, plans);
      setQueueDetail(updated);
      setPerformerTarget(null);
      showToast({
        title: copy('Employee updated'),
        description: copy('Service assignment saved for this transaction.'),
        variant: 'success',
      });
    } catch {
      showToast({
        title: copy('Could not update employee'),
        description: copy('Assignment was not changed. Try again.'),
        variant: 'danger',
      });
    } finally {
      setSavingPerformers(false);
    }
  };

  const completeQueuedTransaction = (transaction: Sale) => {
    const issues = workflowIssues(transaction, workspace.locale);
    if (issues.length) return;
    setCompletionConfirmationTarget(transaction);
  };

  const confirmQueuedCompletion = async () => {
    if (
      !completionConfirmationTarget ||
      workflowIssues(completionConfirmationTarget, workspace.locale).length
    ) {
      return;
    }
    try {
      const finalized = await workspace.finalizeQueuedSale(completionConfirmationTarget);
      setQueueDetail(finalized);
      setQueueTab('COMPLETED');
      setReceiptSaleId(hasSuccessfulPayment(finalized) ? finalized.id : null);
      setCompletionConfirmationTarget(null);
      showToast({
        title: copy('Transaction completed'),
        description: `${transactionNumber(finalized, workspace.locale)} ${copy('has been completed.')}`,
        variant: 'success',
      });
    } catch {
      showToast({
        title: copy('Could not complete transaction'),
        description: copy('Check the transaction status and try again.'),
        variant: 'danger',
      });
    }
  };

  const openAdjustment = async (transaction: Sale) => {
    if (transaction.status !== 'OPEN') return;
    setQueueDetail(null);
    try {
      const hydrated = await workspace.hydrateQueuedSale(transaction.id);
      setAdjustmentTarget(hydrated);
    } catch {
      showToast({
        title: copy('Could not load transaction'),
        description: copy('Reload the transaction before accepting payment.'),
        variant: 'danger',
      });
    }
  };

  const openQueuePayment = async (transaction: Sale) => {
    try {
      const { sale: hydrated, availableToPay } = await workspace.hydrateQueuedPayment(
        transaction.id,
      );
      setQueueDetail(null);
      setPaymentMethod('CASH');
      setProvider('');
      setTender(normalizeCurrencyPresentationInput(availableToPay));
      setQueuePaymentTarget(hydrated);
      setQueuePaymentAmount(availableToPay);
    } catch {
      showToast({
        title: copy('Could not load transaction'),
        description: copy('Reload the transaction before accepting payment.'),
        variant: 'danger',
      });
    }
  };

  const requestCancel = (transaction: Sale) => {
    setCancelTarget(transaction);
    setCancelReason('');
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    const refundAmount = financialSummary(cancelTarget).totalPaid;
    try {
      const canceledSale = await workspace.voidQueuedSale(cancelTarget);
      if (isLocalDemo) {
        writeCancellationReason(canceledSale.id, cancelReason.trim());
        setCancellationReasons((current) => ({
          ...current,
          [canceledSale.id]: cancelReason.trim(),
        }));
      }
      setQueueDetail(canceledSale);
      setQueueTab('CANCELED');
      setReceiptSaleId(null);
      setCancelTarget(null);
      setCancelReason('');
      workspace.closeQueueContext();
      showToast({
        title: copy('Transaction canceled'),
        description: isPositiveDecimal(refundAmount)
          ? `${copy('Refund required')}: ${money(refundAmount, workspace.locale)}. ${copy('Cancellation reason saved.')}`
          : copy('Cancellation reason saved.'),
        variant: 'success',
      });
    } catch (error) {
      showToast({
        title: copy('Cancellation failed'),
        description: cashierTransactionErrorMessage(error),
        variant: 'danger',
      });
    }
  };

  const completeCheckout = async (destination: FulfillmentDestination) => {
    if (!sale || !lines.length) return;

    if (!payNow) {
      try {
        const submitted = await workspace.queueSale(sale);
        commitCheckoutToQueue(submitted, false, destination);
        if (destination === 'START_PROCESS') await startQueuedWork(submitted);
      } catch (error) {
        showToast({
          title: copy('Checkout failed'),
          description: cashierTransactionErrorMessage(error),
          variant: 'danger',
        });
      }
      return;
    }

    const applied = paymentMethod === 'CASH' ? tender || total : total;
    if (!isPositiveDecimal(applied)) return;
    if (paymentMethod === 'CASH' && createDecimal(applied).lessThan(createDecimal(total))) return;
    if ((paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'WALLET') && !provider) return;
    try {
      const completedSale = await workspace.createPayment(
        paymentMethod,
        total,
        paymentMethod === 'CASH' ? applied : undefined,
        provider || undefined,
      );
      if (!hasSuccessfulCheckout(completedSale)) {
        showToast({
          title: copy('Payment incomplete'),
          description: copy('Payment was not completed. The cart remains available.'),
          variant: 'warning',
        });
        return;
      }
      const submitted = await workspace.queueSale(completedSale);
      commitCheckoutToQueue(submitted, true, destination);
      if (destination === 'START_PROCESS') await startQueuedWork(submitted);
    } catch (error) {
      showToast({
        title: copy('Checkout failed'),
        description: `${cashierTransactionErrorMessage(error)} ${copy('The cart was not changed.')}`,
        variant: 'danger',
      });
    }
  };

  const payQueueBalance = async () => {
    const transaction = displayedQueuePaymentTarget;
    if (!transaction || !queuePaymentAmount) return;
    const due = queuePaymentAmount;
    const applied = paymentMethod === 'CASH' ? tender || due : due;
    if (!isPositiveDecimal(applied)) return;
    if (paymentMethod === 'CASH' && createDecimal(applied).lessThan(createDecimal(due))) return;
    if ((paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'WALLET') && !provider) return;
    try {
      const updatedSale = await workspace.createQueuedPayment(
        transaction,
        paymentMethod,
        due,
        paymentMethod === 'CASH' ? applied : undefined,
        provider || undefined,
      );
      setQueuePaymentTarget(null);
      setQueuePaymentAmount(null);
      setQueueDetail(updatedSale);
      setReceiptSaleId(updatedSale.id);
      workspace.closeQueueContext();
      showToast({
        title: hasSuccessfulCheckout(updatedSale)
          ? copy('Payment complete')
          : copy('Payment recorded'),
        description: copy('Transaction status was not changed.'),
        variant: 'success',
      });
    } catch (error) {
      showToast({
        title: copy('Payment failed'),
        description: `${cashierTransactionErrorMessage(error)} ${copy('The balance and queue were not changed.')}`,
        variant: 'danger',
      });
    }
  };

  const quickTender = ['50000', '100000', '150000', '200000', '500000'];
  const normalizedTotal = normalizeCurrencyPresentationInput(total);
  const effectiveTender = tender || normalizedTotal;
  const cashShort =
    paymentMethod === 'CASH' &&
    createDecimal(effectiveTender).lessThan(createDecimal(normalizedTotal));
  const change = cashShort
    ? '0'
    : createDecimal(effectiveTender).minus(createDecimal(normalizedTotal)).toFixed(0);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-3 pb-3 pt-3 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5">
      {workspace.notice ? (
        <div
          role="alert"
          className="mb-3 flex shrink-0 flex-col gap-3 rounded-2xl border border-(--color-warning)/30 bg-(--color-warning)/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 gap-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-(--color-warning)" />
            <div>
              <p className="font-semibold">{copy('Transaction needs attention')}</p>
              <p className="mt-0.5 text-xs text-(--color-text-muted)">{workspace.notice}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {workspace.canRetryLastCommand ? (
              <Button size="sm" variant="outline" onClick={workspace.retryLastCommand}>
                <RotateCcw className="mr-1.5 size-3.5" /> {copy('Try same action')}
              </Button>
            ) : null}
            {workspace.viewModel.primaryMode === 'CONFLICT_REVIEW' ? (
              <Button size="sm" variant="outline" onClick={workspace.acknowledgeLatestState}>
                <CheckCircle2 className="mr-1.5 size-3.5" /> {copy('Reviewed')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {transactionsQuery.isLoading ? (
        <div className="mb-4 shrink-0 rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 rounded-lg" />
              <Skeleton className="h-3 w-56 max-w-full rounded-lg" />
            </div>
            <Skeleton className="hidden h-8 w-56 rounded-xl md:block" />
          </div>
        </div>
      ) : (
        <ReferenceQueueBoard
          open={queueOpen}
          onOpenChange={setQueueOpen}
          active={queueTab}
          onChangeTab={setQueueTab}
          groups={groups}
          issues={queueIssues}
          locale={workspace.locale}
          onStartWork={(transaction) => void startQueuedWork(transaction)}
          onAdjust={openAdjustment}
          onPay={(transaction) => void openQueuePayment(transaction)}
          onCancel={requestCancel}
          onView={setQueueDetail}
          onViewReceipt={(transaction) => {
            setQueueDetail(transaction);
            setReceiptSaleId(transaction.id);
          }}
        />
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 pb-2">
          <div className="flex flex-wrap items-center gap-2 border-b border-(--color-border) pb-2 lg:flex-nowrap">
            <div className="grid shrink-0 grid-cols-2 rounded-xl bg-(--color-surface-muted)/75 p-1 sm:inline-flex sm:items-center">
              <ReferenceTypeButton
                active={workspace.itemType === 'PRODUCT'}
                icon={<ShoppingBag className="size-3.5" />}
                label={copy('Product')}
                onClick={() => selectType('PRODUCT')}
              />
              <ReferenceTypeButton
                active={workspace.itemType === 'SERVICE'}
                icon={<Wrench className="size-3.5" />}
                label={copy('Service')}
                onClick={() => selectType('SERVICE')}
              />
            </div>
            <div className="shrink-0">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={copy('Search items...')}
                debounceMs={0}
                expandedWidth="min(280px, calc(100vw - 140px))"
              />
            </div>
            <div className="hidden h-6 w-px bg-(--color-border) lg:block" aria-hidden="true" />
            <div className="order-3 min-w-0 flex-1 basis-full lg:order-0 lg:basis-0">
              <div className="no-scrollbar flex h-9 items-center gap-1.5 overflow-x-auto border-l border-(--color-border)/70 pl-2 lg:border-l-0 lg:pl-0">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className={`inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold transition-colors ${selectedCategory ? 'bg-(--color-surface-muted) text-(--color-text-muted)' : 'bg-[var(--color-brand)] text-white'}`}
                >
                  {copy('All')}
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className={`inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold transition-colors ${selectedCategory === category.id ? 'bg-(--color-brand) text-white' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 pr-1">
          {workspace.isLoadingCatalog ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 10 }).map((item, index) => (
                <Skeleton key={`${String(item)}-${index}`} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 text-sm text-[var(--color-text-muted)]">
              {copy('No items found')}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleItems.map((item) => (
                <ReferenceCatalogCard
                  key={item.id}
                  item={item}
                  price={workspace.cachedCardPrice(item.id)}
                  locale={workspace.locale}
                  disabled={workspace.viewModel.monetaryMutation.state !== 'AVAILABLE'}
                  onAdd={() => void workspace.selectItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <ReferenceFloatingCart
        open={cartOpen}
        onOpenChange={setCartOpen}
        lines={lines}
        total={total}
        gross={workspace.cart.grossAmount}
        discountAmount={workspace.cart.discountAmount}
        discountLabel={
          sale
            ? transactionDiscountLabel(sale, copy('Promotions and discounts'))
            : copy('Promotions and discounts')
        }
        taxAmount={workspace.cart.taxAmount}
        taxLabel={sale ? saleTaxLabel(sale, copy('Tax')) : copy('Tax')}
        isEstimate={workspace.cart.isLocalDraft}
        locale={workspace.locale}
        customer={activeCustomer}
        onChooseCustomer={() => setCustomerPickerOpen(true)}
        onQuantity={(line, next) => {
          if (workspace.cart.isLocalDraft) workspace.changeDraftQuantity(line.id, next);
          else {
            const serverLine = workspace.viewModel.activeLines.find((item) => item.id === line.id);
            if (serverLine) workspace.changeQuantity(serverLine, next);
          }
        }}
        onRemove={(line) => {
          if (workspace.cart.isLocalDraft) workspace.removeDraftLine(line.id);
          else {
            const serverLine = workspace.viewModel.activeLines.find((item) => item.id === line.id);
            if (serverLine) workspace.removeLine(serverLine);
          }
        }}
        onCheckout={() => void openCheckout()}
      />

      <ReferenceCustomerDialog
        open={customerPickerOpen}
        customer={activeCustomer}
        isSaving={workspace.isCustomerPending}
        onClose={() => setCustomerPickerOpen(false)}
        onChoose={(selection) => {
          // Runtime validates and normalizes the identity; the dialog closes
          // only once the change is accepted.
          void workspace
            .changeCustomer(selection)
            .then(() => setCustomerPickerOpen(false))
            .catch((error: unknown) => {
              showToast({
                title: copy('Could not save the customer'),
                description: cashierTransactionErrorMessage(error),
                variant: 'danger',
              });
            });
        }}
      />

      <ReferencePaymentDialog
        open={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          setCartOpen(true);
        }}
        lines={lines}
        total={total}
        gross={workspace.cart.grossAmount}
        discountAmount={workspace.cart.discountAmount}
        discountLabel={
          sale
            ? transactionDiscountLabel(sale, copy('Promotions and discounts'))
            : copy('Promotions and discounts')
        }
        taxAmount={workspace.cart.taxAmount}
        taxLabel={sale ? saleTaxLabel(sale, copy('Tax')) : copy('Tax')}
        locale={workspace.locale}
        customer={activeCustomer}
        method={paymentMethod}
        provider={provider}
        tender={tender}
        change={change}
        isCashShort={cashShort}
        payNow={payNow}
        onPayNowChange={setPayNow}
        onMethod={(next) => {
          setPaymentMethod(next);
          setProvider('');
        }}
        onProvider={setProvider}
        onTender={setTender}
        quickTender={quickTender}
        isSubmitting={workspace.isCoreMutating}
        onQueue={() => void completeCheckout('QUEUE')}
        adjustmentSlot={<SaleAdjustmentControls workspace={workspace} placement="payment" />}
      />

      <ReferenceTransactionDetail
        sale={displayedQueueDetail}
        locale={workspace.locale}
        employees={workspace.employees}
        businessName={runtime.branding.businessName ?? runtime.branding.productName}
        branchName={copy('Main branch')}
        cashierName={session.identity.displayName}
        {...(displayedQueueDetail && cancellationReasons[displayedQueueDetail.id]
          ? { cancellationReason: cancellationReasons[displayedQueueDetail.id] }
          : {})}
        showPaymentReceipt={Boolean(receiptSaleId && displayedQueueDetail?.id === receiptSaleId)}
        onClose={() => {
          setQueueDetail(null);
          setReceiptSaleId(null);
        }}
        onNewSale={() => {
          setQueueDetail(null);
          setReceiptSaleId(null);
          setCartOpen(false);
          workspace.newSale();
        }}
        onViewReceipt={(transaction) => {
          setQueueDetail(transaction);
          setReceiptSaleId(transaction.id);
        }}
        onSendReceipt={(transaction) => void sendReceipt(transaction)}
        isSendingReceipt={isSendingReceipt}
        onAssign={(line) => {
          if (!displayedQueueDetail) return;
          workspace.requestEmployeeOptions();
          setPerformerTarget({ sale: displayedQueueDetail, line });
        }}
        onComplete={() => {
          if (displayedQueueDetail) void completeQueuedTransaction(displayedQueueDetail);
        }}
        isMutating={workspace.isCoreMutating}
      />

      <ReferenceOrderAdjustmentDialog
        key={displayedAdjustmentTarget?.id ?? 'adjustment-closed'}
        sale={displayedAdjustmentTarget}
        items={workspace.items}
        locale={workspace.locale}
        isMutating={workspace.isCoreMutating}
        variantPicker={
          workspace.variantPicker?.context === 'TRANSACTION_ADJUSTMENT'
            ? workspace.variantPicker
            : null
        }
        onClose={() => {
          workspace.closeVariantPicker();
          setAdjustmentTarget(null);
          workspace.closeQueueContext();
        }}
        onAdd={(item) => void workspace.selectItem(item, 'TRANSACTION_ADJUSTMENT')}
        onAddVariant={(variantId) => void workspace.selectVariant(variantId)}
        onQuantity={(line, next) => workspace.changeQuantity(line, next)}
        onRemove={workspace.removeLine}
      />

      <ReferenceBalancePaymentDialog
        sale={displayedQueuePaymentTarget}
        availableToPay={queuePaymentAmount}
        locale={workspace.locale}
        method={paymentMethod}
        provider={provider}
        tender={tender}
        isMutating={workspace.isCoreMutating}
        onClose={() => {
          setQueuePaymentTarget(null);
          setQueuePaymentAmount(null);
          workspace.closeQueueContext();
        }}
        onMethod={(next) => {
          setPaymentMethod(next);
          setProvider('');
        }}
        onProvider={setProvider}
        onTender={setTender}
        onPay={() => void payQueueBalance()}
      />

      <DConfirmDialog
        open={Boolean(completionConfirmationTarget)}
        onClose={() => setCompletionConfirmationTarget(null)}
        onConfirm={() => void confirmQueuedCompletion()}
        title={copy('Complete transaction')}
        message={
          completionConfirmationTarget
            ? `${copy('Complete transaction')} ${transactionNumber(completionConfirmationTarget, workspace.locale)}? ${copy('Completing this transaction closes finished work.')}`
            : undefined
        }
        confirmLabel={copy('Complete transaction')}
        cancelLabel={copy('Cancel')}
        variant="primary"
        loading={workspace.isCoreMutating}
      />

      <ReferenceCancelDialog
        sale={cancelTarget}
        reason={cancelReason}
        isMutating={workspace.isCoreMutating}
        onReasonChange={setCancelReason}
        onClose={() => {
          setCancelTarget(null);
          workspace.closeQueueContext();
        }}
        onConfirm={confirmCancel}
      />

      {performerTarget ? (
        <ServicePerformersDialog
          key={`${performerTarget.sale.id}:${performerTarget.line.id}`}
          sale={performerTarget.sale}
          lineId={performerTarget.line.id}
          employees={workspace.employees}
          isSaving={isSavingPerformers}
          onClose={() => setPerformerTarget(null)}
          onSave={(plans) => void savePerformers(performerTarget, plans)}
        />
      ) : null}

      {workspace.lineTask ? (
        <SaleLineTaskDialog
          line={workspace.lineTask}
          employees={workspace.employees}
          contributionPreview={workspace.contributionPreview}
          locale={workspace.locale}
          monetaryAvailability={workspace.viewModel.monetaryMutation}
          operationalAvailability={workspace.viewModel.operationalMutation}
          isBusy={workspace.isCoreMutating}
          onClose={workspace.closeLineTask}
          onSetPriceOverride={workspace.setPriceOverride}
          onClearPriceOverride={workspace.clearPriceOverride}
          onSetLineDiscount={workspace.setLineDiscount}
          onClearLineDiscount={workspace.clearLineDiscount}
          onSetAssignments={workspace.setAssignments}
          onSetContributions={workspace.setContributions}
          onTransitionFulfillment={workspace.transitionFulfillment}
        />
      ) : null}
    </div>
  );
}

function ReferenceTypeButton({
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

function ReferenceCatalogCard({
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
  const isService = item.type === 'SERVICE';
  const displayPrice = item.displayPrice;
  const variantCount = item.variants?.length ?? 0;
  const needsVariantChoice = variantCount > 0;
  const duration = formatDurationMinutes(item.serviceDefinition?.defaultDurationMinutes, locale);
  return (
    <button
      type="button"
      aria-label={`${copy(needsVariantChoice ? 'Choose variant' : 'Add')} ${item.name}`}
      disabled={disabled}
      onClick={onAdd}
      className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition-all hover:border-[var(--color-brand)]/40 hover:shadow-md active:scale-[.98] disabled:opacity-50"
    >
      <div
        className={`mb-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl ${isService ? 'bg-cyan-500/10 text-cyan-600' : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'}`}
      >
        {item.image?.url ? (
          <img src={item.image.url} alt="" loading="lazy" className="size-full object-cover" />
        ) : isService ? (
          <Wrench className="size-7" />
        ) : (
          <ShoppingBag className="size-7" />
        )}
      </div>
      <p className="truncate font-mono text-[10px] text-[var(--color-text-muted)]">{item.code}</p>
      <p className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-tight">{item.name}</p>
      {/* Reserved metadata row keeps the price baseline aligned across the grid. */}
      <p className="mt-1 flex min-h-4 items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
        {duration ? (
          <>
            <Clock className="size-3 shrink-0" aria-hidden="true" />
            {duration}
          </>
        ) : null}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-[var(--color-text)]">
        {price
          ? displayPrice?.kind === 'FROM'
            ? `${copy('From')} ${money(price, locale)}`
            : money(price, locale)
          : copy('Price available when selected')}
      </p>
      {/* Items with variants open a picker first, so the card says so instead of implying a direct add. */}
      <p
        className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold ${needsVariantChoice ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'}`}
      >
        {needsVariantChoice ? (
          <>
            {copy('Choose variant')}
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
          </>
        ) : (
          <>
            <Plus className="size-3 shrink-0" aria-hidden="true" />
            {copy('Add')}
          </>
        )}
      </p>
    </button>
  );
}

function ReferenceQueueBoard({
  open,
  onOpenChange,
  active,
  onChangeTab,
  groups,
  issues,
  locale,
  onStartWork,
  onAdjust,
  onPay,
  onCancel,
  onView,
  onViewReceipt,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  active: QueueStatus;
  onChangeTab: (status: QueueStatus) => void;
  groups: Record<QueueStatus, Sale[]>;
  issues: Record<string, string[]>;
  locale: string;
  onStartWork: (sale: Sale) => void;
  onAdjust: (sale: Sale) => void;
  onPay: (sale: Sale) => void;
  onCancel: (sale: Sale) => void;
  onView: (sale: Sale) => void;
  onViewReceipt: (sale: Sale) => void;
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
                  .map((sale) => `${sale.id}:${sale.version}`)
                  .join('|')}`;
                return (
                  <DTabsContent key={status} value={status} className="mt-3">
                    <div key={contentKey} className="pos-queue-content-enter space-y-3">
                      {list.length ? (
                        <div className="no-scrollbar cursor-grab overflow-x-auto overflow-y-hidden pb-3 select-none">
                          <div className="flex w-max gap-4 px-0.5">
                            {list.map((sale) => (
                              <ReferenceQueueCard
                                key={sale.id}
                                sale={sale}
                                status={status}
                                locale={locale}
                                issues={issues[sale.id] ?? []}
                                onStartWork={onStartWork}
                                onAdjust={onAdjust}
                                onPay={onPay}
                                onCancel={onCancel}
                                onView={onView}
                                onViewReceipt={onViewReceipt}
                              />
                            ))}
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

function ReferenceQueueCard({
  sale,
  status,
  locale,
  issues,
  onStartWork,
  onAdjust,
  onPay,
  onCancel,
  onView,
  onViewReceipt,
}: {
  sale: Sale;
  status: QueueStatus;
  locale: string;
  issues: string[];
  onStartWork: (sale: Sale) => void;
  onAdjust: (sale: Sale) => void;
  onPay: (sale: Sale) => void;
  onCancel: (sale: Sale) => void;
  onView: (sale: Sale) => void;
  onViewReceipt: (sale: Sale) => void;
}) {
  const { copy, label } = useOperationalLocalization();
  const meta = statusMeta[status];
  const { balanceDue } = financialSummary(sale);
  const hasPayment = hasSuccessfulPayment(sale);
  const paid = hasSuccessfulCheckout(sale);
  const customer = sale.customer ?? null;
  const canStartWork = hasStartableQueuedWork(sale);
  const actionItems = [
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
          {
            label: copy('Adjust order'),
            icon: <ShoppingBag className="size-3.5" />,
            onSelect: () => onAdjust(sale),
          },
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
          {
            label: copy('Adjust order'),
            icon: <ShoppingBag className="size-3.5" />,
            onSelect: () => onAdjust(sale),
          },
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

function ReferenceFloatingCart({
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
  locale,
  customer,
  onChooseCustomer,
  onQuantity,
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
  locale: string;
  customer: SaleCustomer | null;
  onChooseCustomer: () => void;
  onQuantity: (line: CartDisplayLine, quantity: string) => void;
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
      locale={locale}
      customer={customer}
      onChooseCustomer={onChooseCustomer}
      onQuantity={onQuantity}
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

function ReferenceCartPanel({
  lines,
  total,
  gross,
  discountAmount,
  discountLabel,
  taxAmount,
  taxLabel,
  isEstimate,
  locale,
  customer,
  onChooseCustomer,
  onQuantity,
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
  locale: string;
  customer: SaleCustomer | null;
  onChooseCustomer: () => void;
  onQuantity: (line: CartDisplayLine, quantity: string) => void;
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
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
              {customerDisplayDetail(customer) ??
                copy('Name and WhatsApp number are both required.')}
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
                      <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                        {money(line.effectiveUnitPrice, locale)}
                        {line.variantNameSnapshot ? `, ${line.variantNameSnapshot}` : ''}
                        {line.itemTypeSnapshot === 'SERVICE' ? (
                          <span className="ml-1 font-semibold text-cyan-700">
                            {copy('Service')}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`${copy('Remove')} ${line.itemNameSnapshot}`}
                      onClick={() => onRemove(line)}
                      className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
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
          {hasTax ? (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">{taxLabel}</span>
              <span className="font-medium">{money(taxAmount, locale)}</span>
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

function ReferenceCustomerDialog({
  open,
  customer,
  isSaving,
  onClose,
  onChoose,
}: {
  open: boolean;
  customer: SaleCustomer | null;
  isSaving: boolean;
  onClose: () => void;
  onChoose: (selection: SaleCustomerSelection) => void;
}) {
  const { copy } = useOperationalLocalization();
  const [mode, setMode] = useState<'NON_MEMBER' | 'MEMBER'>('NON_MEMBER');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // Each time the dialog opens it shows the identity the transaction currently
  // carries, never what was typed for an earlier transaction.
  const identityKey = open ? `${customer?.type ?? 'NONE'}:${customer?.phoneE164 ?? ''}` : null;
  if (openedFor !== identityKey) {
    setOpenedFor(identityKey);
    setMode(customer?.type === 'MEMBER' ? 'MEMBER' : 'NON_MEMBER');
    setName(customer?.type === 'NON_MEMBER' ? customer.name : '');
    setPhone(customer?.type === 'NON_MEMBER' ? customer.phoneE164 : '');
  }

  const canSubmit = Boolean(name.trim() && phone.trim()) && !isSaving;
  const submitNonMember = () => {
    if (!canSubmit) return;
    onChoose({ type: 'NON_MEMBER', name: name.trim(), phone: phone.trim() });
  };

  return (
    <DDialog
      title={copy('Choose customer')}
      open={open}
      onClose={onClose}
      ariaLabel={copy('Choose customer')}
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-md overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
    >
      <div className="min-h-0 space-y-3 overflow-y-auto">
        <p className="text-xs text-[var(--color-text-muted)]">
          {copy(
            'A transaction belongs to a customer. Fill in the name and WhatsApp number, or choose a member.',
          )}
        </p>
        <div className="flex gap-2" aria-label={copy('Customer')}>
          <Button
            size="sm"
            variant={mode === 'NON_MEMBER' ? 'primary' : 'secondary'}
            onClick={() => setMode('NON_MEMBER')}
          >
            {copy('Non-member')}
          </Button>
          <Button
            size="sm"
            variant={mode === 'MEMBER' ? 'primary' : 'secondary'}
            onClick={() => setMode('MEMBER')}
          >
            {copy('Member')}
          </Button>
        </div>

        {mode === 'NON_MEMBER' ? (
          <div className="space-y-3">
            <DInput
              aria-label={copy('Customer name')}
              label={copy('Name')}
              value={name}
              onChange={setName}
              placeholder={copy('Customer name')}
            />
            <DInput
              aria-label={copy('WhatsApp number')}
              label={copy('WhatsApp number')}
              value={phone}
              onChange={setPhone}
              placeholder={copy('WhatsApp number')}
              inputMode="tel"
              hint={copy('Name and WhatsApp number are both required.')}
            />
            <Button fullWidth disabled={!canSubmit} onClick={submitNonMember}>
              {copy('Use customer')}
            </Button>
          </div>
        ) : (
          // Member identity is owned by the canonical Customer authority. Until
          // that directory is connected there is nothing truthful to search, so
          // the state says so instead of offering invented members.
          <DAlert variant="info" title={copy('Member lookup is not available yet')}>
            {copy(
              'Member identity comes from the customer directory, which is not connected to this installation yet.',
            )}
          </DAlert>
        )}
      </div>
    </DDialog>
  );
}

function ReferencePaymentDialog({
  open,
  onClose,
  lines,
  total,
  gross,
  discountAmount,
  discountLabel,
  taxAmount,
  taxLabel,
  locale,
  customer,
  method,
  provider,
  tender,
  change,
  isCashShort,
  payNow,
  onPayNowChange,
  onMethod,
  onProvider,
  onTender,
  quickTender,
  isSubmitting,
  onQueue,
  adjustmentSlot,
}: {
  open: boolean;
  onClose: () => void;
  lines: readonly CartDisplayLine[];
  total: string;
  gross: string;
  discountAmount: string;
  discountLabel: string;
  taxAmount: string;
  taxLabel: string;
  locale: string;
  customer: SaleCustomer | null;
  method: PaymentMethod;
  provider: string;
  tender: string;
  change: string;
  isCashShort: boolean;
  payNow: boolean;
  onPayNowChange: (payNow: boolean) => void;
  onMethod: (method: PaymentMethod) => void;
  onProvider: (provider: string) => void;
  onTender: (amount: string) => void;
  quickTender: readonly string[];
  isSubmitting: boolean;
  onQueue: () => void;
  /** Applied promotions and discounts for the authoritative Sale being paid. */
  adjustmentSlot?: ReactNode;
}) {
  const { copy, label } = useOperationalLocalization();
  const { routes: paymentRoutes, isPending: isPaymentRoutesPending } = useCachedPaymentRoutes();
  const routeByMethod = new Map(
    paymentRoutes.map((route) => [route.paymentMethod, route] as const),
  );
  const activeRoute = routeByMethod.get(method) ?? null;
  const isCash = method === 'CASH';
  const needsProvider = method === 'BANK_TRANSFER' || method === 'WALLET';
  const hasDiscount = !createDecimal(discountAmount).equals(createDecimal('0'));
  const hasTax = !createDecimal(taxAmount).equals(createDecimal('0'));
  const customerBadge = customerStatus(customer);
  const canPay =
    lines.length > 0 &&
    Boolean(activeRoute) &&
    !isCashShort &&
    (!needsProvider || Boolean(provider)) &&
    !isSubmitting;
  const canConfirm = payNow ? canPay : lines.length > 0 && !isSubmitting;
  const methods: Array<{ value: PaymentMethod; icon: ReactNode }> = [
    { value: 'CASH', icon: <Banknote className="size-[15px]" /> },
    { value: 'BANK_TRANSFER', icon: <CreditCard className="size-[15px]" /> },
    { value: 'QRIS', icon: <QrCode className="size-[15px]" /> },
    { value: 'WALLET', icon: <ShoppingBag className="size-[15px]" /> },
  ];
  const providerOptions = needsProvider && activeRoute ? [activeRoute.financialAccountName] : [];
  const normalizedQuickTender = [total, ...quickTender]
    .map((amount) => normalizeCurrencyPresentationInput(amount))
    .filter((amount, index, list) => list.indexOf(amount) === index)
    .slice(0, 6);

  return (
    <DDialog
      title={copy('Checkout')}
      open={open}
      onClose={onClose}
      ariaLabel={copy('Checkout')}
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-lg overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <DButton variant="ghost" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton disabled={!canConfirm} loading={isSubmitting} onClick={onQueue}>
            {copy(payNow ? 'Pay and add to queue' : 'Add to queue')}
          </DButton>
        </div>
      }
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">{copy('Payment total')}</p>
              <h3
                key={total}
                className="pos-value-updated mt-0.5 text-2xl font-bold leading-tight tabular-nums text-[var(--color-brand)]"
              >
                {money(total, locale)}
              </h3>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-xs text-[var(--color-text-muted)]">{copy('Customer')}</p>
              <p className="max-w-[170px] truncate text-sm font-semibold">
                {customerDisplayName(customer, locale)}
              </p>
              {customerBadge ? (
                <Badge variant={customerBadge.variant} className="mt-1 px-2 py-0 text-[10px]">
                  {copy(customerBadge.label)}
                </Badge>
              ) : null}
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {lines.length} {copy('items')}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-[var(--color-surface-muted)]/60 px-3 py-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">{copy('Subtotal')}</span>
              <span className="font-semibold">{money(gross, locale)}</span>
            </div>
            {hasDiscount ? (
              <div className="mt-1 flex justify-between">
                <span className="text-[var(--color-text-muted)]">{discountLabel}</span>
                <span className="font-semibold text-[var(--color-danger)]">
                  −{money(discountAmount, locale)}
                </span>
              </div>
            ) : null}
            {hasTax ? (
              <div className="mt-1 flex justify-between">
                <span className="text-[var(--color-text-muted)]">{taxLabel}</span>
                <span className="font-semibold">{money(taxAmount, locale)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-[var(--color-border)] pt-2 text-sm">
              <span className="font-bold">{copy('Total')}</span>
              <span className="font-bold text-[var(--color-brand)]">{money(total, locale)}</span>
            </div>
          </div>
        </div>

        {adjustmentSlot}

        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {copy('Order details')}
            </p>
            <span className="text-xs text-[var(--color-text-muted)]">
              {lines.length} {copy('items')}
            </span>
          </div>
          <div className="max-h-[120px] divide-y divide-[var(--color-border)] overflow-y-auto">
            {lines.map((line) => {
              const discountPercentage = lineDiscountPercentage(line);
              return (
                <div key={line.id} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{line.itemNameSnapshot}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
                        {line.itemTypeSnapshot === 'SERVICE' ? (
                          <span className="ml-1 font-semibold text-[var(--color-brand)]">
                            {copy('Service')}
                          </span>
                        ) : null}
                      </p>
                      {isPositiveDecimal(line.lineDiscountAmount) ? (
                        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                          {copy('Item discount')}
                          {discountPercentage ? ` (${discountPercentage}%)` : ''}: −
                          {money(line.lineDiscountAmount, locale)}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-bold">{money(line.totalAmount, locale)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two named outcomes, because this choice changes the checkout flow instead of toggling a setting. */}
        <fieldset className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {copy('Payment timing')}
          </legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {[
              {
                value: true,
                title: copy('Pay now'),
                description: copy('Choose a payment method before continuing.'),
              },
              {
                value: false,
                title: copy('Pay later'),
                description: copy('Payment can be recorded after transaction creation.'),
              },
            ].map((option) => (
              <label
                key={String(option.value)}
                className={`pos-choice ${payNow === option.value ? 'pos-choice--selected' : ''}`}
              >
                <DRadio
                  name="pos-payment-timing"
                  className="mt-0.5 shrink-0"
                  checked={payNow === option.value}
                  onChange={() => onPayNowChange(option.value)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{option.title}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-[var(--color-text-muted)]">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {payNow ? (
          <>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {copy('Payment method')}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {methods.map((option) => {
                  const routeAvailable = routeByMethod.has(option.value);
                  const disabled = isPaymentRoutesPending || !routeAvailable;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => onMethod(option.value)}
                      className={`flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 ${method === option.value ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white shadow-sm' : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'}`}
                    >
                      {option.icon}
                      <span className="pos-payment-method-label">{label(option.value)}</span>
                    </button>
                  );
                })}
              </div>
              {needsProvider ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold text-[var(--color-text-muted)]">
                    {copy(method === 'BANK_TRANSFER' ? 'Select bank' : 'Select digital wallet')}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {providerOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onProvider(option)}
                        className={`h-9 rounded-xl border px-3 text-xs font-semibold transition-all active:scale-[.98] ${provider === option ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {method === 'QRIS' ? (
                <div className="mt-3 rounded-xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/5 p-3">
                  <p className="text-sm font-bold text-[var(--color-brand)]">QRIS</p>
                  {activeRoute ? (
                    <p className="mt-1 text-xs font-semibold text-[var(--color-text)]">
                      {activeRoute.financialAccountName}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {copy('QRIS payment will be recorded for this transaction.')}
                  </p>
                </div>
              ) : null}
            </div>

            {isCash ? (
              <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                <label className="block text-sm font-medium">
                  {copy('Amount paid')}
                  <div className="relative mt-1.5">
                    <PosCurrencyInput
                      aria-label={copy('Amount paid')}
                      className="h-10 rounded-lg bg-[var(--color-surface)] text-right text-lg font-bold"
                      value={tender}
                      onChange={onTender}
                    />
                  </div>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {normalizedQuickTender.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => onTender(amount)}
                      className={`h-9 rounded-lg border text-[11px] font-semibold transition-all active:scale-[.98] ${normalizeCurrencyPresentationInput(tender) === amount ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-surface-muted)]'}`}
                    >
                      {money(amount, locale)}
                    </button>
                  ))}
                </div>
                <div
                  className={`flex items-center justify-between rounded-xl px-3 py-2 ${isCashShort ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'}`}
                >
                  <span className="text-sm font-bold">
                    {copy(isCashShort ? 'Payment short' : 'Change')}
                  </span>
                  <span className="text-sm font-bold">
                    {isCashShort
                      ? money(
                          createDecimal(normalizeCurrencyPresentationInput(total))
                            .minus(createDecimal(normalizeCurrencyPresentationInput(tender || '0')))
                            .toFixed(0),
                          locale,
                        )
                      : money(change, locale)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/5 p-3">
                <p className="text-sm font-bold text-[var(--color-brand)]">
                  {copy('Payment')} {label(method)}
                </p>
                {activeRoute ? (
                  <p className="mt-1 text-xs font-semibold text-[var(--color-text)]">
                    {activeRoute.financialAccountName}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {copy('Select a provider if required, then record the payment.')}
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </DDialog>
  );
}

function useRetainedValue<T>(value: T | null): T | null {
  // Keep the last value while a DS dialog plays its close transition.
  const [retained, setRetained] = useState<T | null>(value);
  if (value !== null && value !== retained) setRetained(value);
  return value ?? retained;
}

const fulfillmentTone: Record<string, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
  WAITING: 'warning',
  IN_PROGRESS: 'brand',
  COMPLETED: 'success',
  CANCELED: 'danger',
};

function queueStatusTone(status: QueueStatus | null) {
  if (status === 'QUEUED') return 'warning' as const;
  if (status === 'PROGRESS') return 'brand' as const;
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'CANCELED') return 'danger' as const;
  return 'neutral' as const;
}

function ReferenceTransactionDetail({
  sale: currentSale,
  locale,
  employees,
  businessName,
  branchName,
  cashierName,
  cancellationReason,
  showPaymentReceipt,
  onClose,
  onViewReceipt,
  onSendReceipt,
  isSendingReceipt,
  onAssign,
  onComplete,
  isMutating,
}: {
  sale: Sale | null;
  locale: string;
  employees: readonly Employee[];
  businessName: string;
  branchName: string;
  cashierName: string;
  cancellationReason?: string;
  showPaymentReceipt: boolean;
  onClose: () => void;
  onNewSale: () => void;
  onViewReceipt: (sale: Sale) => void;
  onSendReceipt?: (sale: Sale) => void;
  isSendingReceipt?: boolean;
  onAssign: (line: SaleLine) => void;
  onComplete: () => void;
  isMutating: boolean;
}) {
  const { copy, label } = useOperationalLocalization();
  const [receiptPaper, setReceiptPaper] = useState<'58' | '80'>('80');
  const sale = useRetainedValue(currentSale);
  if (!sale) return null;
  const open = currentSale !== null;
  const status = queueStatus(sale);
  const customer = sale.customer ?? null;
  const activeLines = sale.lines.filter((line) => !line.removedAt);
  const payments = successfulPayments(sale).filter((payment) =>
    createDecimal(payment.appliedAmount).greaterThan(createDecimal('0')),
  );
  const payment = payments[payments.length - 1] ?? null;
  const receiptAvailable = payments.length > 0;
  const showReceipt = showPaymentReceipt && receiptAvailable;
  const { totalPaid } = financialSummary(sale);
  const settlement = saleSettlement(sale);
  const hasDiscount = !createDecimal(sale.discountAmount).equals(createDecimal('0'));
  const hasTax = !createDecimal(sale.taxAmount).equals(createDecimal('0'));
  const completionIssues = status === 'PROGRESS' ? workflowIssues(sale, locale) : [];
  const completionIssueGroups = groupWorkflowIssues(sale, completionIssues, locale);
  const transactionDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(sale.finalizedAt ?? sale.updatedAt));
  const identity = transactionNumber(sale, locale);
  const format = (amount: string) => money(amount, locale);
  const discountRows = saleDiscountRows(sale);
  const summaryDiscounts =
    discountRows.length === 0 && hasDiscount
      ? [
          {
            id: 'sale-discount',
            source: 'MANUAL_DISCOUNT' as const,
            scope: 'TRANSACTION' as const,
            saleLineId: null,
            label: copy('Promotions and discounts'),
            amount: sale.discountAmount,
            percentage: null,
            reason: null,
          },
        ]
      : discountRows;
  const paymentStateLabel =
    settlement.paymentState === 'PAID'
      ? 'Paid'
      : settlement.paymentState === 'PARTIALLY_PAID'
        ? 'Partially paid'
        : 'Unpaid';

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={copy(showReceipt ? 'Preview receipt' : 'Transaction details')}
        description={identity}
        ariaLabel={copy(showReceipt ? 'Preview receipt' : 'Transaction details')}
        closeOnEscape
        closeOnOverlay
        noPadding
        size="md"
        className="pos-reference-dialog max-h-[92dvh] w-full overflow-hidden"
        footer={
          showReceipt ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span
                  id="pos-receipt-paper-label"
                  className="text-xs text-[var(--color-text-muted)]"
                >
                  {copy('Paper width')}
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="pos-receipt-paper-label"
                  className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-1"
                >
                  {(['58', '80'] as const).map((paper) => (
                    <button
                      key={paper}
                      type="button"
                      role="radio"
                      aria-checked={receiptPaper === paper}
                      onClick={() => setReceiptPaper(paper)}
                      className={`min-h-8 rounded-[calc(var(--radius-control)-2px)] px-3 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/30 ${
                        receiptPaper === paper
                          ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                      }`}
                    >
                      {paper} mm
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                <DButton variant="ghost" onClick={onClose}>
                  {copy('Close')}
                </DButton>
                {onSendReceipt ? (
                  <DButton
                    variant="outline"
                    loading={Boolean(isSendingReceipt)}
                    onClick={() => onSendReceipt(sale)}
                  >
                    {copy('Send via WhatsApp')}
                  </DButton>
                ) : null}
                <DButton
                  variant="primary"
                  leftIcon={<Printer className="size-3.5" />}
                  onClick={() => window.print()}
                >
                  {copy('Print')}
                </DButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <DButton variant="ghost" onClick={onClose}>
                {copy('Close')}
              </DButton>
              {receiptAvailable ? (
                <DButton
                  rightIcon={<Printer className="size-3.5" />}
                  variant="outline"
                  onClick={() => onViewReceipt(sale)}
                >
                  {copy('View receipt')}
                </DButton>
              ) : null}
              {status === 'PROGRESS' ? (
                <DButton
                  variant="primary"
                  disabled={completionIssues.length > 0}
                  loading={isMutating}
                  leftIcon={<CheckCircle2 className="size-3.5" />}
                  onClick={onComplete}
                >
                  {copy('Complete transaction')}
                </DButton>
              ) : null}
            </div>
          )
        }
      >
        {showReceipt ? (
          // The receipt sits as paper on a muted desk; the dialog body is the only scroll region.
          <div className="pos-receipt-desk">
            <div
              className={`pos-receipt-preview pos-receipt-print--${receiptPaper} bg-white text-slate-950`}
            >
              <ReceiptContent
                sale={sale}
                activeLines={activeLines}
                customer={customer}
                locale={locale}
                businessName={businessName}
                branchName={branchName}
                cashierName={cashierName}
                transactionDate={transactionDate}
                totalPaid={totalPaid}
                payment={payment}
                hasDiscount={hasDiscount}
                hasTax={hasTax}
              />
            </div>
          </div>
        ) : (
          <div className="pos-detail-story flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-6">
            <SaleDetailHeader
              eyebrow={copy('Transaction')}
              number={identity}
              secondaryNumber={sale.invoiceNumber}
              badges={
                <>
                  <StatusPill
                    tone={queueStatusTone(status)}
                    icon={status ? statusMeta[status].icon : null}
                  >
                    {status ? label(statusMeta[status].value) : label('OPEN')}
                  </StatusPill>
                  <StatusPill
                    tone={
                      settlement.paymentState === 'PAID'
                        ? 'success'
                        : settlement.paymentState === 'PARTIALLY_PAID'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {copy(paymentStateLabel)}
                  </StatusPill>
                </>
              }
              totalLabel={copy('Total')}
              total={format(sale.totalAmount)}
              settlementNote={
                settlement.balanceDue !== '0.0000' ? (
                  <span className="text-[var(--color-warning)]">
                    {copy('Balance due')} {format(settlement.balanceDue)}
                  </span>
                ) : null
              }
              meta={[
                { label: copy('Date'), value: transactionDate },
                {
                  label: copy('Customer'),
                  value: (
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate">{customerDisplayName(customer, locale)}</span>
                      {customerStatus(customer) ? (
                        <Badge
                          variant={customerStatus(customer)!.variant}
                          className="shrink-0 text-[10px]"
                        >
                          {copy(customerStatus(customer)!.label)}
                        </Badge>
                      ) : null}
                      {customerDisplayDetail(customer) ? (
                        <span className="w-full text-xs font-normal text-[var(--color-text-muted)]">
                          {customerDisplayDetail(customer)}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
              ]}
            />

            {sale.status === 'VOIDED' && cancellationReason ? (
              <div className="rounded-[var(--radius-control)] border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-3 py-2 text-xs">
                <p className="font-semibold text-[var(--color-danger)]">
                  {copy('Cancellation reason')}
                </p>
                <p className="mt-1 text-[var(--color-text-muted)]">{cancellationReason}</p>
              </div>
            ) : null}

            {completionIssues.length ? (
              <div className="rounded-[var(--radius-control)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-xs">
                <p className="font-semibold text-[var(--color-warning)]">
                  {copy('Not ready to complete')}
                </p>
                <div className="mt-2 space-y-2 text-[var(--color-text-muted)]">
                  {completionIssueGroups.map((group) => (
                    <div key={group.id}>
                      <p className="font-semibold text-[var(--color-text)]">{group.label}</p>
                      <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                        {group.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <SaleDetailSection
              title={copy('Order')}
              aside={`${activeLines.length} ${copy('items')}`}
            >
              <SaleLineItemList>
                {activeLines.map((line) => {
                  const isTrackedService =
                    line.itemTypeSnapshot === 'SERVICE' &&
                    line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
                    line.fulfillment !== null;
                  const requiresEmployeeAttribution =
                    line.employeeAssignmentModeSnapshot !== 'NONE' ||
                    line.allowEmployeeContributionSnapshot;
                  const attributed = isTrackedService && requiresEmployeeAttribution;
                  const plannedUnits = line.workUnits?.length ?? 0;
                  const needsAttention =
                    attributed &&
                    (employeeAssignmentIssues(line, locale).length > 0 ||
                      (plannedUnits > 0 && plannedUnits !== serviceWorkUnitCount(line)));
                  const durationLabel = formatDurationMinutes(
                    line.defaultDurationMinutesSnapshot,
                    locale,
                  );
                  const workSummary = attributed
                    ? servicePerformerSummary(line, employees, locale)
                    : null;
                  const editable = attributed && status === 'PROGRESS';
                  return (
                    <SaleLineItem
                      key={line.id}
                      name={line.itemNameSnapshot}
                      variant={line.variantNameSnapshot}
                      pricing={`${quantity(line.quantity)} × ${format(line.effectiveUnitPrice)}`}
                      amount={format(line.grossAmount)}
                      discounts={lineDiscountRows(sale, line, copy('Discount')).map((row) => ({
                        ...row,
                        amount: format(row.amount),
                      }))}
                      context={
                        line.fulfillment || durationLabel ? (
                          <>
                            {line.fulfillment ? (
                              <StatusPill
                                tone={fulfillmentTone[line.fulfillment.status] ?? 'neutral'}
                              >
                                {label(line.fulfillment.status)}
                              </StatusPill>
                            ) : null}
                            {durationLabel ? <span>{durationLabel}</span> : null}
                          </>
                        ) : null
                      }
                      detail={
                        workSummary ? (
                          <ServicePerformerSummary
                            itemName={line.itemNameSnapshot}
                            summary={workSummary}
                            needsAttention={needsAttention}
                            editable={editable}
                            disabled={isMutating}
                            onEdit={() => onAssign(line)}
                          />
                        ) : null
                      }
                    />
                  );
                })}
              </SaleLineItemList>
            </SaleDetailSection>

            <SaleDetailSection title={copy('Order summary')} surface="muted">
              <SaleFinancialSummary
                labels={{
                  subtotal: copy('Subtotal'),
                  total: copy('Total'),
                  paid: copy('Paid amount'),
                  balance: copy('Balance due'),
                  settled: copy('Paid'),
                  cashReceived: copy('Cash received'),
                  change: copy('Change'),
                  discount: copy('Discount'),
                  discountContext: (row) =>
                    `${copy(row.source === 'PROMOTION' ? 'Promotion' : 'Manual discount')} · ${copy(
                      row.scope === 'TRANSACTION'
                        ? 'Whole transaction'
                        : row.scope === 'ITEM'
                          ? 'Item-level'
                          : 'Category-level',
                    )}`,
                }}
                gross={sale.grossAmount}
                discounts={summaryDiscounts}
                tax={
                  hasTax ? { label: saleTaxLabel(sale, copy('Tax')), amount: sale.taxAmount } : null
                }
                total={sale.totalAmount}
                settlement={settlement}
                format={format}
              />
            </SaleDetailSection>

            {sale.payments.length ? (
              <SaleDetailSection title={copy('Payment history')}>
                <SalePaymentList
                  emptyLabel={copy('No payment recorded yet.')}
                  payments={sale.payments.map((item) => ({
                    id: item.id,
                    method: label(item.method),
                    status: (
                      <StatusPill
                        tone={
                          item.status === 'SUCCEEDED'
                            ? 'success'
                            : item.status === 'PENDING'
                              ? 'warning'
                              : 'danger'
                        }
                      >
                        {label(item.status)}
                      </StatusPill>
                    ),
                    detail: new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(item.terminalAt ?? item.updatedAt)),
                    amount: format(item.appliedAmount),
                  }))}
                />
              </SaleDetailSection>
            ) : null}
          </div>
        )}
      </Dialog>

      {open && showReceipt
        ? createPortal(
            <div className={`pos-receipt-print pos-receipt-print--${receiptPaper}`}>
              <ReceiptContent
                sale={sale}
                activeLines={activeLines}
                customer={customer}
                locale={locale}
                businessName={businessName}
                branchName={branchName}
                cashierName={cashierName}
                transactionDate={transactionDate}
                totalPaid={totalPaid}
                payment={payment}
                hasDiscount={hasDiscount}
                hasTax={hasTax}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ReceiptContent({
  sale,
  activeLines,
  customer,
  locale,
  businessName,
  branchName,
  cashierName,
  transactionDate,
  totalPaid,
  payment,
  hasDiscount,
  hasTax,
}: {
  sale: Sale;
  activeLines: readonly SaleLine[];
  customer: SaleCustomer | null;
  locale: string;
  businessName: string;
  branchName: string;
  cashierName: string;
  transactionDate: string;
  totalPaid: string;
  payment: Payment | null;
  hasDiscount: boolean;
  hasTax: boolean;
}) {
  const { copy } = useOperationalLocalization();
  const discountRows = saleDiscountRows(sale);
  return (
    <>
      <header className="text-center">
        <h2 className="text-lg font-black tracking-tight">{businessName}</h2>
        <p className="mt-1 text-xs text-slate-500">{branchName}</p>
        <div className="my-4 border-t border-dashed border-slate-300" />
        <p className="font-mono text-xs font-semibold">{transactionNumber(sale, locale)}</p>
        <p className="mt-1 text-[11px] text-slate-500">{transactionDate}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          {copy('Cashier')}: {cashierName}
        </p>
      </header>

      <section className="mt-4 text-xs">
        <p className="font-semibold">{copy('Customer')}</p>
        <p className="mt-1">{customerDisplayName(customer, locale)}</p>
        {customerDisplayDetail(customer) ? (
          <p className="text-slate-500">{customerDisplayDetail(customer)}</p>
        ) : null}
      </section>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <section className="space-y-2.5">
        {activeLines.map((line) => {
          const lineDiscounts = lineDiscountRows(sale, line, copy('Discount'));
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
              <p className="mt-1 text-slate-500">
                {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
              </p>
              {lineDiscounts.map((discount) => (
                <div
                  key={discount.id}
                  className="mt-1 flex items-start justify-between gap-3 text-slate-500"
                >
                  <span className="min-w-0">
                    {discount.title}
                    {discount.note ? (
                      <span className="block break-words text-[10px] leading-3">
                        {discount.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0">−{money(discount.amount, locale)}</span>
                </div>
              ))}
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
        {discountRows.map((row) => {
          const text = discountPresentation(row, copy('Discount'));
          return (
            <div key={row.id} className="flex items-start justify-between gap-3">
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
        {hasTax ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{saleTaxLabel(sale, copy('Tax'))}</dt>
            <dd>{money(sale.taxAmount, locale)}</dd>
          </div>
        ) : null}
        <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 text-sm font-black">
          <dt>{copy('Total').toUpperCase()}</dt>
          <dd>{money(sale.totalAmount, locale)}</dd>
        </div>
      </dl>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <section className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">{copy('Paid amount')}</span>
          <span>{money(totalPaid, locale)}</span>
        </div>
        {payment?.method === 'CASH' ? (
          <>
            {payment.tenderedAmount ? (
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">{copy('Cash received')}</span>
                <span>{money(payment.tenderedAmount, locale)}</span>
              </div>
            ) : null}
            {isPositiveDecimal(payment.changeAmount ?? '0') ? (
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">{copy('Change')}</span>
                <span>{money(payment.changeAmount ?? '0.0000', locale)}</span>
              </div>
            ) : null}
          </>
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

function ReferenceOrderAdjustmentDialog({
  sale,
  items,
  locale,
  isMutating,
  variantPicker,
  onClose,
  onAdd,
  onAddVariant,
  onQuantity,
  onRemove,
}: {
  sale: Sale | null;
  items: readonly CatalogItem[];
  locale: string;
  isMutating: boolean;
  variantPicker: VariantPickerState | null;
  onClose: () => void;
  onAdd: (item: CatalogItem) => void;
  onAddVariant: (catalogVariantId: string) => void;
  onQuantity: (line: SaleLine, quantity: string) => void;
  onRemove: (line: SaleLine) => void;
}) {
  const { copy } = useOperationalLocalization();
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(false);
  // Quantities when the dialog opened; only rows that differ show what changed.
  const [baseline] = useState<ReadonlyMap<string, string>>(
    () =>
      new Map(
        (sale?.lines ?? [])
          .filter((line) => line.removedAt === null)
          .map((line) => [line.id, line.quantity]),
      ),
  );
  const [variantSelection, setVariantSelection] = useState<{
    itemId: string;
    variantId: string;
  } | null>(null);
  const selectedVariantId =
    variantSelection && variantSelection.itemId === variantPicker?.item.id
      ? variantSelection.variantId
      : null;

  if (!sale) return null;

  const activeLines = sale.lines.filter((line) => line.removedAt === null);
  const removedCount = [...baseline.keys()].filter(
    (lineId) => !activeLines.some((line) => line.id === lineId),
  ).length;
  const changed =
    removedCount > 0 ||
    activeLines.some((line) => {
      const before = baseline.get(line.id);
      return before === undefined || !createDecimal(before).equals(createDecimal(line.quantity));
    });
  // Both figures come from the Runtime-returned Sale after each command.
  const settlement = saleSettlement(sale);
  const paidAmount = createDecimal(settlement.totalPaid);
  const saleTotal = createDecimal(sale.totalAmount);
  const consequence = paidAmount.greaterThan(saleTotal)
    ? {
        label: copy('Refund'),
        amount: paidAmount.minus(saleTotal).toFixed(4),
        tone: 'text-[var(--color-warning)]',
      }
    : paidAmount.greaterThan(createDecimal('0')) && saleTotal.greaterThan(paidAmount)
      ? {
          label: copy('Additional payment'),
          amount: settlement.balanceDue,
          tone: 'text-[var(--color-brand)]',
        }
      : { label: copy('Total'), amount: sale.totalAmount, tone: 'text-[var(--color-text)]' };
  const options = items
    .filter((item) => {
      const query = catalogSearch.trim().toLocaleLowerCase();
      return !query || `${item.name} ${item.code}`.toLocaleLowerCase().includes(query);
    })
    .slice(0, 12)
    .map((item) => ({
      value: item.id,
      label: `${item.name} (${item.code})`,
    }));
  const stepperClass =
    'flex size-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <Dialog
      open
      onClose={onClose}
      title={copy('Adjust order')}
      description={transactionNumber(sale, locale)}
      ariaLabel={copy('Adjust order')}
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0" aria-live="polite">
            <p className="text-[11px] text-[var(--color-text-muted)]">{consequence.label}</p>
            <p className={`text-base font-semibold tabular-nums ${consequence.tone}`}>
              {money(consequence.amount, locale)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {changed ? null : (
              <Button variant="ghost" onClick={onClose}>
                {copy('Cancel')}
              </Button>
            )}
            <Button disabled={isMutating} onClick={onClose}>
              {copy('Save adjustment')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          {copy(
            hasSuccessfulPayment(sale)
              ? 'Each change is recorded right away. Items already paid stay on the payment record.'
              : 'Each change is recorded right away.',
          )}
        </p>
        <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
          {activeLines.map((line) => {
            const lineMutable = !line.fulfillment || line.fulfillment.status === 'WAITING';
            const canDecrease =
              lineMutable && createDecimal(line.quantity).greaterThan(createDecimal('1'));
            const before = baseline.get(line.id);
            const lineChange =
              before === undefined
                ? copy('New')
                : createDecimal(before).equals(createDecimal(line.quantity))
                  ? null
                  : `${copy('Was')} ${quantity(before)}`;
            return (
              <li key={line.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm"
                    title={`${line.itemNameSnapshot}${line.variantNameSnapshot ? ` · ${line.variantNameSnapshot}` : ''}`}
                  >
                    <span className="font-semibold">{line.itemNameSnapshot}</span>
                    {line.variantNameSnapshot ? (
                      <span className="text-[var(--color-text-muted)]">
                        {' '}
                        · {line.variantNameSnapshot}
                      </span>
                    ) : null}
                  </p>
                  <p className="flex items-center gap-2 text-xs tabular-nums text-[var(--color-text-muted)]">
                    {money(line.effectiveUnitPrice, locale)}
                    {lineChange ? (
                      <span className="rounded-full bg-[var(--color-brand)]/10 px-1.5 text-[10px] font-semibold text-[var(--color-brand)]">
                        {lineChange}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`${copy('Decrease quantity')} ${line.itemNameSnapshot}`}
                    disabled={!canDecrease || isMutating}
                    onClick={() =>
                      onQuantity(
                        line,
                        createDecimal(line.quantity).minus(createDecimal('1')).toFixed(4),
                      )
                    }
                    className={stepperClass}
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-7 text-center text-xs font-semibold tabular-nums">
                    {quantity(line.quantity)}
                  </span>
                  <button
                    type="button"
                    aria-label={`${copy('Increase quantity')} ${line.itemNameSnapshot}`}
                    disabled={!lineMutable || isMutating}
                    onClick={() =>
                      onQuantity(
                        line,
                        createDecimal(line.quantity).plus(createDecimal('1')).toFixed(4),
                      )
                    }
                    className={stepperClass}
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${copy('Remove')} ${line.itemNameSnapshot}`}
                    disabled={!lineMutable || isMutating}
                    onClick={() => onRemove(line)}
                    className="ml-0.5 flex size-8 items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {removedCount ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            {removedCount} {copy('items removed')}
          </p>
        ) : null}

        {catalogOpen || variantPicker ? (
          <div className="space-y-2">
            <Combobox
              ariaLabel={copy('Add item from catalog')}
              value={null}
              placeholder={copy('Search product or service')}
              options={options}
              onSearchChange={setCatalogSearch}
              onChange={(itemId) => {
                const item = items.find((candidate) => candidate.id === itemId);
                if (item) onAdd(item);
              }}
              disabled={isMutating}
              idleMessage={copy('Search by item name or code.')}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            disabled={isMutating}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 disabled:opacity-50"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {copy('Add item from catalog')}
          </button>
        )}

        {variantPicker ? (
          <section className="rounded-xl border border-[var(--color-border)] p-3">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {variantPicker.item.name}
              </p>
              <Select
                label={copy('Variant')}
                value={selectedVariantId}
                placeholder={copy('Select variant')}
                options={variantPicker.variants.map((variant) => {
                  const price = variantPicker.pricesByVariantId?.[variant.id];
                  const isUnavailable =
                    variantPicker.unavailableVariantIds?.includes(variant.id) ?? false;
                  return {
                    value: variant.id,
                    label: isUnavailable
                      ? `${variant.name} (${copy('Price unavailable')})`
                      : price
                        ? `${variant.name} (${money(price, locale)})`
                        : variant.name,
                    disabled: isUnavailable,
                  };
                })}
                onChange={(value) =>
                  setVariantSelection(
                    typeof value === 'string'
                      ? { itemId: variantPicker.item.id, variantId: value }
                      : null,
                  )
                }
                disabled={isMutating}
                className="w-full"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  leftIcon={<Plus className="size-3.5" />}
                  disabled={selectedVariantId === null || isMutating}
                  onClick={() => {
                    if (selectedVariantId) onAddVariant(selectedVariantId);
                  }}
                >
                  {copy('Add item')}
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}

function ReferenceBalancePaymentDialog({
  sale,
  availableToPay,
  locale,
  method,
  provider,
  tender,
  isMutating,
  onClose,
  onMethod,
  onProvider,
  onTender,
  onPay,
}: {
  sale: Sale | null;
  availableToPay: string | null;
  locale: string;
  method: PaymentMethod;
  provider: string;
  tender: string;
  isMutating: boolean;
  onClose: () => void;
  onMethod: (method: PaymentMethod) => void;
  onProvider: (provider: string) => void;
  onTender: (amount: string) => void;
  onPay: () => void;
}) {
  const { copy, label } = useOperationalLocalization();
  const { routes: paymentRoutes, isPending: isPaymentRoutesPending } = useCachedPaymentRoutes();
  const routeByMethod = new Map(
    paymentRoutes.map((route) => [route.paymentMethod, route] as const),
  );
  const activeRoute = routeByMethod.get(method) ?? null;
  if (!sale) return null;
  const { totalPaid } = financialSummary(sale);
  const balanceDue = availableToPay ?? '0.0000';
  const isCash = method === 'CASH';
  const needsProvider = method === 'BANK_TRANSFER' || method === 'WALLET';
  const applied = isCash ? tender || balanceDue : balanceDue;
  const cashShort = isCash && createDecimal(applied).lessThan(createDecimal(balanceDue));
  const canPay =
    isPositiveDecimal(applied) &&
    Boolean(activeRoute) &&
    !cashShort &&
    (!needsProvider || Boolean(provider)) &&
    !isMutating;
  const methods: Array<{ value: PaymentMethod; icon: ReactNode }> = [
    { value: 'CASH', icon: <Banknote className="size-4" /> },
    { value: 'BANK_TRANSFER', icon: <CreditCard className="size-4" /> },
    { value: 'QRIS', icon: <QrCode className="size-4" /> },
    { value: 'WALLET', icon: <ShoppingBag className="size-4" /> },
  ];
  const providerOptions = needsProvider && activeRoute ? [activeRoute.financialAccountName] : [];

  return (
    <Dialog
      open
      onClose={onClose}
      title={copy(hasSuccessfulPayment(sale) ? 'Pay balance' : 'Pay')}
      description={transactionNumber(sale, locale)}
      ariaLabel={copy('Payment')}
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-md overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {copy('Cancel')}
          </Button>
          <Button disabled={!canPay} loading={isMutating} onClick={onPay}>
            {copy('Pay')} {money(balanceDue, locale)}
          </Button>
        </div>
      }
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-sm">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">{copy('Paid amount')}</p>
            <p className="mt-1 font-semibold">{money(totalPaid, locale)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--color-text-muted)]">{copy('Balance')}</p>
            <p className="mt-1 font-bold text-[var(--color-brand)]">{money(balanceDue, locale)}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {methods.map((option) => {
            const routeAvailable = routeByMethod.has(option.value);
            const disabled = isPaymentRoutesPending || !routeAvailable;
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => onMethod(option.value)}
                className={`flex h-10 items-center justify-center gap-1 rounded-xl border text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${method === option.value ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'}`}
              >
                {option.icon}
                <span className="pos-payment-method-label">{label(option.value)}</span>
              </button>
            );
          })}
        </div>
        {needsProvider ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {providerOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onProvider(option)}
                className={`h-9 rounded-lg border px-3 text-xs font-semibold ${provider === option ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'}`}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
        {isCash ? (
          <label className="block text-sm font-medium">
            {copy('Amount paid')}
            <PosCurrencyInput
              aria-label={copy('Amount paid')}
              className="mt-1.5 h-10 rounded-lg text-right text-lg font-bold"
              value={tender}
              onChange={onTender}
            />
            {cashShort ? (
              <span className="mt-1 block text-xs text-[var(--color-warning)]">
                {copy('Payment amount is insufficient.')}
              </span>
            ) : null}
          </label>
        ) : (
          <div className="rounded-xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/5 p-3 text-xs text-[var(--color-text-muted)]">
            <p>
              {copy('Record payment')} {label(method)} {money(balanceDue, locale)}.
            </p>
            {activeRoute ? (
              <p className="mt-1 font-semibold text-[var(--color-text)]">
                {activeRoute.financialAccountName}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function ReferenceCancelDialog({
  sale,
  reason,
  isMutating,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  sale: Sale | null;
  reason: string;
  isMutating: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { copy, locale } = useOperationalLocalization();
  const refundAmount = sale ? financialSummary(sale).totalPaid : '0.0000';
  const hasRefund = isPositiveDecimal(refundAmount);
  return (
    <Dialog
      open={Boolean(sale)}
      title={copy('Cancel transaction')}
      description={sale ? transactionNumber(sale, locale) : ''}
      onClose={onClose}
      ariaLabel={copy('Cancel transaction')}
      closeOnEscape={!isMutating}
      closeOnOverlay={!isMutating}
      className="pos-reference-dialog w-full max-w-md rounded-t-2xl bg-(--color-surface) shadow-xl sm:rounded-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={isMutating} onClick={onClose}>
            {copy('Back')}
          </Button>
          <Button
            variant="danger"
            disabled={!reason.trim() || isMutating}
            loading={isMutating}
            onClick={onConfirm}
          >
            {copy('Confirm cancellation')}
          </Button>
        </div>
      }
    >
      <>
        {hasRefund ? (
          <div className="mt-4 rounded-xl border border-(--color-warning)/30 bg-(--color-warning)/10 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-(--color-warning)">
                {copy('Refund required')}
              </span>
              <span className="text-sm font-bold text-(--color-warning)">
                {money(refundAmount, locale)}
              </span>
            </div>
            <p className="mt-1 text-xs text-(--color-text-muted)">
              {copy('Previous payment remains recorded')}
            </p>
          </div>
        ) : null}
        <label className="mt-5 block text-sm font-medium">
          {copy('Cancellation reason')}
          <DTextarea
            className="mt-1.5 h-10 rounded-lg"
            autoFocus
            value={reason}
            disabled={isMutating}
            onChange={onReasonChange}
            placeholder={copy('Example: Customer request')}
          />
        </label>
      </>
    </Dialog>
  );
}
