import { createDecimal, formatMoney } from '@digvation/pos-money';
import { DButton } from '@digvation-labs/ui';
import { DAvatar, DBadge } from '@digvation/ui';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Pencil,
  PlayCircle,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';

import {
  operationalCopy,
  resolveOperationalLocale,
  useOperationalLocalization,
} from '../../../../app/localization/operational-localization';
import type { CartDisplayLine } from '../../cart-draft';
import { employeeDisplayName, formatServiceDuration } from '../../sale-presentation';
import type {
  Employee,
  Payment,
  PaymentMethod,
  PaymentStatus,
  QueueSale,
  Sale,
  SaleCustomer,
  SaleLine,
} from '../../cashier-transaction.types';
import type { useCashierTransactionWorkspace } from '../../use-cashier-transaction-workspace';

import { amountFractionDigits } from '../../components/pos-controls';
import {
  serviceWorkUnitAllocations,
  serviceWorkUnitCount,
} from '../../components/service-performers-dialog';
import {
  formatPercent,
  formatUnitRanges,
  groupAllocations,
  resolveAllocation,
  type PerformerAllocation,
} from '../../service-performer-allocation';
import { isFullySettled } from '../../sale-lifecycle';

export type Workspace = ReturnType<typeof useCashierTransactionWorkspace>;
export type QueueStatus = 'QUEUED' | 'PROGRESS' | 'COMPLETED' | 'CANCELED';
export type FulfillmentDestination = 'QUEUE' | 'START_PROCESS';
export interface QueuedSaleEntry {
  saleId: string;
  sellingLocationId: string;
  saleCreatedAt: string;
}

export const QUEUED_SALE_IDS_KEY = 'digvation-pos-demo-queued-sale-ids';
export const CANCELED_SALE_REASONS_KEY = 'digvation-pos-demo-canceled-sale-reasons';

export function copyFor(value: string, locale: string): string {
  return operationalCopy(value, resolveOperationalLocale(locale));
}

export function readQueuedSaleEntries(): QueuedSaleEntry[] {
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

export function writeQueuedSaleEntries(entries: readonly QueuedSaleEntry[]): void {
  try {
    window.sessionStorage.setItem(QUEUED_SALE_IDS_KEY, JSON.stringify(entries));
  } catch {
    // Queue presentation state remains available for the current session when storage is unavailable.
  }
}

export function readCancellationReasons(): Record<string, string> {
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

export function writeCancellationReason(saleId: string, reason: string): void {
  try {
    window.sessionStorage.setItem(
      CANCELED_SALE_REASONS_KEY,
      JSON.stringify({ ...readCancellationReasons(), [saleId]: reason }),
    );
  } catch {
    // This local/demo presentation metadata is optional when session storage is unavailable.
  }
}

export const statusMeta: Record<
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

export function money(amount: string, locale: string) {
  // Whole IDR stays clean; a genuinely fractional authoritative amount keeps its fraction.
  return formatMoney(amount, 'IDR', locale, Math.min(4, amountFractionDigits(amount)));
}

export function wholePointValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d+)(?:\.0+)?$/.exec(value.trim());
  return match?.[1] ?? null;
}

export function pointQuantity(value: string | null | undefined, locale: string): string {
  const whole = wholePointValue(value);
  if (whole === null) return '—';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(whole));
}

export function formatDurationMinutes(
  minutes: number | null | undefined,
  locale: string,
): string | null {
  return formatServiceDuration(minutes, {
    hour: copyFor('hour-short', locale),
    minute: copyFor('minute-short', locale),
  });
}

export function quantity(value: string) {
  const normalized = value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  return normalized === '-0' ? '0' : normalized;
}

export function transactionNumber(sale: Pick<Sale, 'id' | 'saleNumber'>, locale: string) {
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
export function customerDisplayName(
  customer: Pick<SaleCustomer, 'name'> | null,
  locale: string,
): string {
  return customer && customer.name.trim()
    ? customer.name
    : copyFor('Customer data is not available', locale);
}

export function customerDisplayDetail(customer: SaleCustomer | null): string | null {
  return customer && customer.phoneE164.trim() ? customer.phoneE164 : null;
}

export function customerInitials(customer: SaleCustomer | null): string {
  const name = customer?.name?.trim();
  if (!name) return '—';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function customerStatus(customer: SaleCustomer | null): {
  label: 'Member' | 'Non-member';
  variant: 'primary' | 'outline';
} | null {
  if (!customer) return null;
  return customer.type === 'MEMBER'
    ? { label: 'Member', variant: 'primary' }
    : { label: 'Non-member', variant: 'outline' };
}

/**
 * Total points a FINALIZED Sale earned, exactly as Runtime reports its immutable EARN fact. It is
 * the one value shown by Transaction Detail and the receipt; it is never summed from line rows
 * (a TRANSACTION_TOTAL Sale has none) and never shown as +0.
 */
/**
 * The member point facts a receipt states once for the whole Sale: the balance right after this
 * Sale (historical, not today's), what it earned and what it used. Per-line earning stays line detail.
 */
export function receiptPointSummary(
  sale: Pick<Sale, 'status' | 'loyaltyEarning' | 'loyaltySummary' | 'customer'>,
  customer: Pick<SaleCustomer, 'type'> | null,
): {
  balanceAfter: string | null;
  earnedPoints: string | null;
  redeemedPoints: string | null;
} | null {
  if (customer?.type !== 'MEMBER') return null;
  const summary = sale.loyaltySummary;
  if (summary)
    return {
      balanceAfter: summary.balanceAfter,
      earnedPoints: isPositiveDecimal(summary.earnedPoints) ? summary.earnedPoints : null,
      redeemedPoints: isPositiveDecimal(summary.redeemedPoints) ? summary.redeemedPoints : null,
    };
  const earned = saleEarnedPoints(sale);
  return earned ? { balanceAfter: null, earnedPoints: earned, redeemedPoints: null } : null;
}

export function saleEarnedPoints(
  sale: Pick<Sale, 'status' | 'loyaltyEarning' | 'customer'>,
): string | null {
  const earning = sale.loyaltyEarning;
  if (sale.status !== 'FINALIZED' || earning?.state !== 'FINALIZED') return null;
  if (sale.customer && sale.customer.type !== 'MEMBER') return null;
  return isPositiveDecimal(earning.pointsEarned) ? earning.pointsEarned : null;
}

export interface PerformerCredit {
  employeeId: string;
  name: string;
  /** Shown only when the split was set by hand; an even split needs no numbers. */
  percent: string | null;
}

export interface PerformerGroup {
  /** Units this setting covers, e.g. "1–2, 4–7"; null when it covers the whole line. */
  units: string | null;
  performers: PerformerCredit[];
}

/**
 * Who performs a service line. Units with an identical assignment collapse
 * into one group, so a line reads as one setting unless units really differ.
 */
export function servicePerformerSummary(
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
export const VISIBLE_PERFORMER_GROUPS = 3;

/** Avatars stacked for one shared unit; more people than this collapse into the names. */
export const VISIBLE_AVATARS = 3;

/**
 * Who works one unit. The avatar carries identity so the name reads as a
 * person. Several people on ONE unit overlap their avatars and add a
 * "Shared work" caption; that is what tells it apart from several quantity
 * units, which are listed as separate rows instead.
 */
export function PerformerCredits({
  performers,
  allWork = false,
}: {
  performers: readonly PerformerCredit[];
  /** The same person performs every unit of a quantity above one. */
  allWork?: boolean;
}) {
  const { copy } = useOperationalLocalization();
  if (!performers.length)
    return (
      <span className="flex min-h-6 items-center">
        <DBadge variant="warning" dot>
          {copy('No employee yet')}
        </DBadge>
      </span>
    );
  const shared = performers.length > 1;
  return (
    <span className="flex min-w-0 items-start gap-2">
      <span className="mt-0 flex shrink-0 -space-x-1.5" aria-hidden="true">
        {performers.slice(0, VISIBLE_AVATARS).map((performer) => (
          <DAvatar
            key={performer.employeeId}
            size="xs"
            name={performer.name}
            className="rounded-full ring-2 ring-(--color-surface)"
          />
        ))}
      </span>
      <span className="min-w-0">
        <span className="block wrap-break-word text-xs leading-6">
          {performers.map((performer, index) => (
            <span key={performer.employeeId}>
              {index > 0 ? <span className="text-(--color-text-muted)">, </span> : null}
              <span className="font-medium text-(--color-text)">{performer.name}</span>
              {performer.percent ? (
                <span className="ml-1 whitespace-nowrap text-xs tabular-nums text-(--color-text-muted)">
                  {performer.percent}
                </span>
              ) : null}
            </span>
          ))}
          {allWork ? (
            <span className="text-xs text-(--color-text-muted)"> · {copy('All work')}</span>
          ) : null}
        </span>
        {shared ? (
          <span className="block text-[11px] leading-4 text-(--color-text-muted)">
            {copy('Shared work')}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * Who performs one service line, and the action that changes it, as ONE block:
 * the action sits on the same row as the people it edits. One setting is one
 * row; a structured "Work 1 / Work 2" list appears only when units really
 * differ. Quantity is never repeated as names.
 */
export function ServicePerformers({
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

  return (
    <div
      role="group"
      aria-label={`${copy('Performed by')}: ${itemName}`}
      className="mt-2 flex min-w-0 items-start justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        {varied ? (
          <>
            <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
              {shown.map((group) => (
                <Fragment key={group.units}>
                  <dt className="whitespace-nowrap text-xs leading-6 tabular-nums text-(--color-text-muted)">
                    {copy('Work')} {group.units}
                  </dt>
                  <dd className="m-0 min-w-0">
                    <PerformerCredits performers={group.performers} />
                  </dd>
                </Fragment>
              ))}
            </dl>
            {foldable ? (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
                className="mt-1 inline-flex min-h-6 items-center gap-1 rounded-md text-xs font-semibold text-(--color-brand) hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus)/30"
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
          <PerformerCredits
            performers={groups[0]?.performers ?? []}
            allWork={unitCount > 1 && (groups[0]?.performers.length ?? 0) > 0}
          />
        )}
      </div>
      {editable ? (
        needsAttention ? (
          <DButton
            size="sm"
            variant="soft"
            disabled={disabled}
            leftIcon={<UserPlus className="size-3.5" aria-hidden="true" />}
            aria-label={`${copy('Choose employee')}: ${itemName}`}
            className="-mt-0.5 h-7 shrink-0 px-2"
            onClick={onEdit}
          >
            {copy('Choose employee')}
          </DButton>
        ) : (
          <DButton
            size="icon"
            variant="ghost"
            disabled={disabled}
            title={copy('Change employee')}
            aria-label={`${copy('Change employee')}: ${itemName}`}
            className="-my-1 -mr-1.5 size-8 shrink-0 text-(--color-text-muted)"
            onClick={onEdit}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </DButton>
        )
      ) : null}
    </div>
  );
}

export function queueStatus(
  sale: Pick<QueueSale, 'status' | 'operationalState'>,
): QueueStatus | null {
  if (sale.status === 'FINALIZED') return 'COMPLETED';
  if (sale.status === 'VOIDED') return 'CANCELED';
  if (sale.operationalState === 'IN_PROGRESS') return 'PROGRESS';
  if (sale.operationalState === 'QUEUED') return 'QUEUED';
  return null;
}

export function isPositiveDecimal(value: string) {
  try {
    return createDecimal(value).greaterThan(createDecimal('0'));
  } catch {
    return false;
  }
}

export function employeeAssignmentIssues(
  line: SaleLine,
  locale: string,
  // A corrected replacement is staffed on its retired historical source line.
  workLine: SaleLine = line,
): string[] {
  const issues: string[] = [];
  if (
    line.employeeAssignmentModeSnapshot === 'REQUIRED' &&
    !workLine.participations.some((participation) => participation.assigned)
  ) {
    issues.push(`${line.itemNameSnapshot}: ${copyFor('Select an employee.', locale)}`);
  }
  if (line.allowEmployeeContributionSnapshot) {
    const shares = workLine.participations.filter(
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

export function workflowIssues(sale: Sale, locale: string) {
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

    const workLine =
      (line.workLineage
        ? sale.lines.find((candidate) => candidate.id === line.workLineage!.sourceLineId)
        : null) ?? line;
    const plannedUnits = workLine.workUnits?.length ?? 0;
    if (plannedUnits > 0 && plannedUnits !== serviceWorkUnitCount(workLine)) {
      issues.push(
        `${line.itemNameSnapshot}: ${copyFor('Every work unit needs at least one employee.', locale)}`,
      );
      continue;
    }

    issues.push(...employeeAssignmentIssues(line, locale, workLine));
  }
  return issues;
}

export interface WorkflowIssueGroup {
  id: string;
  label: string;
  issues: string[];
}

export function groupWorkflowIssues(
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

export function processIssues(
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

export function hasSuccessfulCheckout(sale: Sale): boolean {
  return isFullySettled(sale);
}

export function successfulPayments(sale: Sale) {
  return sale.payments.filter((payment) => payment.status === 'SUCCEEDED');
}

export function financialSummary(sale: Sale) {
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

export function paymentAccountLabel(
  payment: Payment,
  fallback: (method: PaymentMethod) => string,
): string {
  return payment.financeFinancialAccountNameSnapshot?.trim() || fallback(payment.method);
}

export type TerminalPaymentStatus = Exclude<PaymentStatus, 'PENDING'>;

export function hasSuccessfulPayment(sale: Sale): boolean {
  return successfulPayments(sale).some((payment) =>
    createDecimal(payment.appliedAmount).greaterThan(createDecimal('0')),
  );
}
