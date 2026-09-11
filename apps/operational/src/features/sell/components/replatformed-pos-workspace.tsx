import { useAuth } from '@digvation/pos-auth';
import { createDecimal, formatMoney } from '@digvation/pos-money';
import { useRuntime } from '@digvation/pos-runtime';
import {
  DBadge as Badge,
  DButton,
  DButton as Button,
  DCheckbox,
  DCombobox,
  DCombobox as Combobox,
  DConfirmDialog,
  DDialog,
  DDialog as Dialog,
  DDropdown as Dropdown,
  DInput,
  DInput as Input,
  DSearchInput as SearchInput,
  DSelect as Select,
  DSkeleton as Skeleton,
  useToast,
} from '@digvation-labs/ui';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronDown,
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

import { cashierTransactionKeys } from '../cashier-transaction-keys';
import type { CartDisplayLine } from '../cart-draft';
import {
  createCashierTransactionAdapter,
  isLocalCashierDemoEnabled,
} from '../cashier-transaction-adapter-factory';
import {
  customerMemberLookup,
  type MemberCustomerLookupResult,
  type TransactionCustomer,
} from '../customer-member-lookup';
import type {
  CatalogItem,
  Employee,
  Payment,
  PaymentMethod,
  Sale,
  SaleLine,
} from '../cashier-transaction.types';
import type { CatalogItemTypeFilter } from '../use-selling-catalog';
import type { useCashierTransactionWorkspace } from '../use-cashier-transaction-workspace';

import { PosCurrencyInput, PosNumericInput } from './pos-controls';
import { SaleLineTaskDialog } from './sale-line-task-dialog';
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

type PosCustomer = TransactionCustomer;
interface ServiceWorkContributor {
  employeeId: string;
  shareRate: string;
}

interface ServiceWorkUnit {
  index: number;
  contributors: readonly ServiceWorkContributor[];
}

type ServiceWorkUnitsByLine = Readonly<Record<string, readonly ServiceWorkUnit[]>>;

const CURRENT_CUSTOMER_KEY = 'digvation-pos-demo-current-customer';
const QUEUED_SALE_IDS_KEY = 'digvation-pos-demo-queued-sale-ids';
const CANCELED_SALE_REASONS_KEY = 'digvation-pos-demo-canceled-sale-reasons';
const saleCustomerKey = (saleId: string) => `digvation-pos-demo-customer:${saleId}`;

function readStoredCustomer(key: string): PosCustomer | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PosCustomer) : null;
  } catch {
    return null;
  }
}

function writeStoredCustomer(key: string, customer: PosCustomer | null): void {
  try {
    if (customer) window.sessionStorage.setItem(key, JSON.stringify(customer));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Session storage is optional presentation state only.
  }
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
  { label: string; icon: ReactNode; tone: string; soft: string }
> = {
  QUEUED: {
    label: 'Antrian',
    icon: <Clock className="size-[15px]" />,
    tone: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    soft: 'bg-[var(--color-warning)]/[.045]',
  },
  PROGRESS: {
    label: 'Dikerjakan',
    icon: <PlayCircle className="size-[15px]" />,
    tone: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]',
    soft: 'bg-[var(--color-brand)]/[.045]',
  },
  COMPLETED: {
    label: 'Selesai',
    icon: <CheckCircle2 className="size-[15px]" />,
    tone: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
    soft: 'bg-[var(--color-success)]/[.045]',
  },
  CANCELED: {
    label: 'Dibatalkan',
    icon: <XCircle className="size-[15px]" />,
    tone: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
    soft: 'bg-[var(--color-danger)]/[.045]',
  },
};

function money(amount: string, locale: string) {
  return formatMoney(amount, 'IDR', locale, 0);
}

function quantity(value: string) {
  const normalized = value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  return normalized === '-0' ? '0' : normalized;
}

function transactionNumber(saleId: string) {
  return saleId.startsWith('SALE-DEMO-') ? saleId : `Sale ${saleId.slice(0, 8)}`;
}

function saleCustomer(saleId?: string): PosCustomer {
  const stored = saleId ? readStoredCustomer(saleCustomerKey(saleId)) : null;
  return stored ?? { name: 'Pelanggan umum', phone: '' };
}

function customerStatus(customer: PosCustomer | null): {
  label: 'Guest' | 'Member' | 'Non-member';
  variant: 'default' | 'primary' | 'outline';
} {
  if (!customer) return { label: 'Guest', variant: 'default' };
  if (customer.membership) return { label: 'Member', variant: 'primary' };
  return { label: 'Non-member', variant: 'outline' };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function employeeSummary(line: SaleLine, employees: readonly Employee[]): string {
  const assigned = line.participations.filter((participation) => participation.assigned);
  if (!assigned.length) return 'Pilih karyawan';
  return assigned
    .map((participation) => {
      const employee = employees.find((candidate) => candidate.id === participation.employeeId);
      const share = participation.shareRate
        ? ` ${createDecimal(participation.shareRate).times(100).toFixed(0)}%`
        : '';
      return `${employee?.displayName ?? participation.employeeId}${share}`;
    })
    .join(' · ');
}

function serviceWorkKey(line: SaleLine): string {
  return `${line.saleId}:${line.id}`;
}

function serviceWorkUnitCount(line: SaleLine): number {
  try {
    const quantity = createDecimal(line.quantity);
    if (!quantity.isInteger() || quantity.lessThanOrEqualTo(createDecimal('1'))) return 1;
    const count = quantity.toNumber();
    return Number.isSafeInteger(count) ? count : 1;
  } catch {
    return 1;
  }
}

function defaultWorkContributors(line: SaleLine): ServiceWorkContributor[] {
  return line.participations
    .filter((participation) => participation.assigned)
    .map((participation) => ({
      employeeId: participation.employeeId,
      shareRate: participation.shareRate ?? '0.0000',
    }));
}

function serviceWorkUnitsFor(
  line: SaleLine,
  storedUnits: readonly ServiceWorkUnit[] | undefined,
): ServiceWorkUnit[] {
  const count = serviceWorkUnitCount(line);
  const storedByIndex = new Map(storedUnits?.map((unit) => [unit.index, unit]));
  const fallbackContributors = defaultWorkContributors(line);

  return Array.from({ length: count }, (value, index) => {
    void value;
    const stored = storedByIndex.get(index);
    return {
      index,
      contributors: stored?.contributors ?? fallbackContributors,
    };
  });
}

function contributionTotal(contributors: readonly ServiceWorkContributor[]) {
  return contributors.reduce(
    (total, contributor) => total.plus(createDecimal(contributor.shareRate || '0')),
    createDecimal('0'),
  );
}

function hasValidWorkAssignment(line: SaleLine, unit: ServiceWorkUnit): boolean {
  if (
    line.employeeAssignmentModeSnapshot === 'REQUIRED' &&
    !unit.contributors.some((contributor) => contributor.employeeId)
  ) {
    return false;
  }
  if (line.allowEmployeeContributionSnapshot) {
    return (
      unit.contributors.length > 0 &&
      unit.contributors.every((contributor) => Boolean(contributor.employeeId)) &&
      contributionTotal(unit.contributors).equals(createDecimal('1'))
    );
  }
  return true;
}

function serviceWorkAssignmentSummary(
  units: readonly ServiceWorkUnit[],
  employees: readonly Employee[],
): string {
  const assignments = units.map((unit) =>
    unit.contributors
      .filter((contributor) => contributor.employeeId)
      .map((contributor) => `${contributor.employeeId}:${contributor.shareRate}`)
      .join('|'),
  );
  const firstAssignment = assignments[0] ?? '';
  if (!firstAssignment || assignments.some((assignment) => !assignment))
    return 'Belum ada karyawan';
  const configurationCount = new Set(assignments).size;
  if (configurationCount > 1) return `${configurationCount} konfigurasi`;

  const names = (units[0]?.contributors ?? [])
    .filter((contributor) => contributor.employeeId)
    .map(
      (contributor) =>
        employees.find((employee) => employee.id === contributor.employeeId)?.displayName ??
        contributor.employeeId,
    );
  return `${names.join(' · ')} untuk semua`;
}

function employeeWorkSummary(line: SaleLine, employees: readonly Employee[]): string {
  const assigned = line.participations.filter((participation) => participation.assigned);
  if (!assigned.length) return 'Belum ditentukan';
  return assigned
    .map((participation) => {
      const employee = employees.find((candidate) => candidate.id === participation.employeeId);
      const share = participation.shareRate
        ? `${createDecimal(participation.shareRate).times(100).toFixed(0)}%`
        : null;
      return share
        ? `${employee?.displayName ?? participation.employeeId} · ${share}`
        : (employee?.displayName ?? participation.employeeId);
    })
    .join(' · ');
}

function queueStatus(sale: Sale, includeOpenSales = false): QueueStatus | null {
  if (sale.status === 'FINALIZED') return 'COMPLETED';
  if (sale.status === 'VOIDED') return 'CANCELED';
  if (
    sale.lines.some(
      (line) =>
        line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
        (line.fulfillment?.status === 'IN_PROGRESS' || line.fulfillment?.startedAt !== null),
    )
  ) {
    return 'PROGRESS';
  }
  if (
    includeOpenSales ||
    sale.lines.some(
      (line) =>
        line.fulfillmentBehaviorSnapshot === 'TRACKED' && line.fulfillment?.status === 'WAITING',
    )
  ) {
    return 'QUEUED';
  }
  return null;
}

function isPositiveDecimal(value: string) {
  try {
    return createDecimal(value).greaterThan(createDecimal('0'));
  } catch {
    return false;
  }
}

function employeeAssignmentIssues(line: SaleLine): string[] {
  const issues: string[] = [];
  if (
    line.employeeAssignmentModeSnapshot === 'REQUIRED' &&
    !line.participations.some((participation) => participation.assigned)
  ) {
    issues.push(`${line.itemNameSnapshot}: pilih karyawan.`);
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
      issues.push(`${line.itemNameSnapshot}: kontribusi karyawan harus tepat 100%.`);
    }
  }
  return issues;
}

function workflowIssues(sale: Sale, serviceWorkUnits: ServiceWorkUnitsByLine = {}) {
  const issues: string[] = [];
  const active = sale.lines.filter((line) => line.removedAt === null);
  if (!active.length) issues.push('Tambahkan setidaknya satu item.');

  const succeeded = sale.payments
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum.plus(createDecimal(payment.appliedAmount)), createDecimal('0'));
  if (!succeeded.equals(createDecimal(sale.totalAmount))) {
    issues.push('Pembayaran berhasil harus sama dengan total transaksi.');
  }
  if (sale.payments.some((payment) => payment.status === 'PENDING')) {
    issues.push('Selesaikan pembayaran yang masih pending.');
  }

  for (const line of active) {
    if (!isPositiveDecimal(line.quantity))
      issues.push(`${line.itemNameSnapshot}: qty harus lebih dari 0.`);
    if (!isPositiveDecimal(line.effectiveUnitPrice))
      issues.push(`${line.itemNameSnapshot}: harga harus valid.`);
    const requiresTrackedServiceAssignment =
      line.itemTypeSnapshot === 'SERVICE' && line.fulfillmentBehaviorSnapshot === 'TRACKED';
    if (!requiresTrackedServiceAssignment) continue;

    const units = serviceWorkUnitsFor(line, serviceWorkUnits[serviceWorkKey(line)]);
    if (units.length > 1) {
      if (units.some((unit) => !hasValidWorkAssignment(line, unit))) {
        issues.push(
          `${line.itemNameSnapshot}: setiap pengerjaan membutuhkan karyawan dengan kontribusi tepat 100%.`,
        );
      }
      continue;
    }

    issues.push(...employeeAssignmentIssues(line));
  }
  return issues;
}

interface WorkflowIssueGroup {
  id: string;
  label: string;
  issues: string[];
}

function groupWorkflowIssues(sale: Sale, issues: readonly string[]): WorkflowIssueGroup[] {
  const activeLines = sale.lines.filter((line) => line.removedAt === null);
  const groups = new Map<string, WorkflowIssueGroup>();

  for (const issue of issues) {
    const line = activeLines.find((candidate) =>
      issue.startsWith(`${candidate.itemNameSnapshot}:`),
    );
    const id = line?.id ?? 'transaction';
    const label = line?.itemNameSnapshot ?? 'Transaksi';
    const detail = line ? issue.slice(`${line.itemNameSnapshot}:`.length).trim() : issue;
    const group = groups.get(id) ?? { id, label, issues: [] };
    group.issues.push(detail);
    groups.set(id, group);
  }

  return [...groups.values()];
}

function processIssues(sale: Sale | null, lines: readonly CartDisplayLine[]): string[] {
  if (!lines.length) return ['Tambahkan setidaknya satu item ke cart.'];
  if (sale && sale.status !== 'OPEN') return ['Hanya transaksi aktif yang dapat diproses.'];

  return lines.flatMap((line) => {
    if (!isPositiveDecimal(line.quantity))
      return [`${line.itemNameSnapshot}: qty harus lebih dari 0.`];
    if (!isPositiveDecimal(line.effectiveUnitPrice))
      return [`${line.itemNameSnapshot}: harga belum tersedia.`];
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
  return successfulPayments(sale).length > 0;
}

export function ReplatformedPosWorkspace({ workspace }: { workspace: Workspace }) {
  const runtime = useRuntime();
  const { session, authPort } = useAuth();
  const { showToast } = useToast();
  const isLocalDemo = isLocalCashierDemoEnabled();
  const adapter = useMemo(
    () => createCashierTransactionAdapter(runtime, authPort.getAccessToken.bind(authPort)),
    [authPort, runtime],
  );
  const transactionsQuery = useQuery({
    queryKey: cashierTransactionKeys.sales(),
    queryFn: ({ signal }) => adapter.listSales(signal),
  });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [queueTab, setQueueTab] = useState<QueueStatus>('QUEUED');
  const [queuedSaleEntries, setQueuedSaleEntries] = useState<QueuedSaleEntry[]>(() =>
    isLocalDemo ? readQueuedSaleEntries() : [],
  );
  const [queueIssues, setQueueIssues] = useState<Record<string, string[]>>({});
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
  const [cartCustomer, setCartCustomer] = useState<PosCustomer | null>(() =>
    readStoredCustomer(CURRENT_CUSTOMER_KEY),
  );
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payNow, setPayNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [provider, setProvider] = useState('');
  const [tender, setTender] = useState('');
  const [completionConfirmationTarget, setCompletionConfirmationTarget] = useState<Sale | null>(
    null,
  );
  const [assignmentLine, setAssignmentLine] = useState<SaleLine | null>(null);
  const [queueAssignmentTarget, setQueueAssignmentTarget] = useState<{
    sale: Sale;
    line: SaleLine;
  } | null>(null);
  const [serviceWorkTarget, setServiceWorkTarget] = useState<{
    sale: Sale;
    line: SaleLine;
  } | null>(null);
  const [serviceWorkUnits, setServiceWorkUnits] = useState<ServiceWorkUnitsByLine>({});
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);

  const sale = workspace.viewModel.sale;
  const lines = workspace.cart.lines;
  const total = workspace.cart.totalAmount;

  useEffect(() => {
    writeStoredCustomer(CURRENT_CUSTOMER_KEY, cartCustomer);
    if (sale?.id) writeStoredCustomer(saleCustomerKey(sale.id), cartCustomer);
  }, [cartCustomer, sale?.id]);

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
      QUEUED: records.filter((record) => queueStatus(record, isLocalDemo) === 'QUEUED'),
      PROGRESS: records.filter((record) => queueStatus(record, isLocalDemo) === 'PROGRESS'),
      COMPLETED: records.filter((record) => queueStatus(record, isLocalDemo) === 'COMPLETED'),
      CANCELED: records.filter((record) => queueStatus(record, isLocalDemo) === 'CANCELED'),
    };
  }, [isLocalDemo, queuedSaleEntries, transactionsQuery.data, workspace.selectedLocationId]);

  const selectType = (type: CatalogItemTypeFilter) => {
    workspace.setItemType(type);
    setSelectedCategory('');
  };
  const openCheckout = async () => {
    const issues = processIssues(sale, lines);
    if (issues.length) {
      showToast({ title: 'Cart belum siap checkout', description: issues[0], variant: 'warning' });
      return;
    }
    if (workspace.viewModel.synchronization !== 'CLEAN') {
      showToast({
        title: 'Tunggu perubahan selesai',
        description: 'Cart sedang menyinkronkan perubahan terakhir.',
        variant: 'warning',
      });
      return;
    }

    let checkoutTotal = total;
    if (workspace.cart.isLocalDraft) {
      try {
        const committed = await workspace.commitDraft();
        checkoutTotal = committed.totalAmount;
      } catch {
        showToast({
          title: 'Cart belum dapat dibuat',
          description: 'Tidak ada transaksi parsial yang disimpan. Periksa cart lalu coba lagi.',
          variant: 'danger',
        });
        return;
      }
    }

    setTender(checkoutTotal);
    setPayNow(true);
    setPaymentMethod('CASH');
    setProvider('');
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const commitCheckoutToQueue = (
    completedSale: Sale,
    wasPaid: boolean,
    destination: FulfillmentDestination,
  ) => {
    writeStoredCustomer(saleCustomerKey(completedSale.id), cartCustomer);
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
    setCartCustomer(null);
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
      title: wasPaid ? 'Pembayaran berhasil' : 'Transaksi berhasil dibuat',
      description:
        destination === 'START_PROCESS'
          ? `${transactionNumber(completedSale.id)} masuk antrian dan siap dimulai.`
          : wasPaid
            ? `${transactionNumber(completedSale.id)} lunas dan masuk antrian.`
            : `${transactionNumber(completedSale.id)} masuk antrian. Pembayaran masih belum diterima.`,
      variant: 'success',
    });
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const resume = (transaction: Sale) => {
    workspace.resumeSale(transaction.id);
    const customer = readStoredCustomer(saleCustomerKey(transaction.id));
    setCartCustomer(customer);
    writeStoredCustomer(CURRENT_CUSTOMER_KEY, customer);
    setQueueIssues((current) => ({ ...current, [transaction.id]: [] }));
    setCartOpen(true);
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
        title: 'Tidak ada pekerjaan yang dapat dimulai',
        description: 'Transaksi ini tidak memiliki layanan yang menunggu proses operasional.',
        variant: 'warning',
      });
      return false;
    }
    try {
      await workspace.startQueuedFulfillment(transaction, line);
      setQueueTab('PROGRESS');
      showToast({
        title: 'Pekerjaan dimulai',
        description: `${transactionNumber(transaction.id)} sekarang sedang dikerjakan.`,
        variant: 'success',
      });
      return true;
    } catch {
      showToast({
        title: 'Gagal memulai pekerjaan',
        description: 'Transaksi tetap berada dalam antrian.',
        variant: 'danger',
      });
      return false;
    }
  };
  const saveServiceWorkUnits = async (
    target: { sale: Sale; line: SaleLine },
    units: readonly ServiceWorkUnit[],
  ) => {
    if (units.some((unit) => !hasValidWorkAssignment(target.line, unit))) {
      showToast({
        title: 'Lengkapi karyawan terlebih dahulu',
        description: 'Setiap pengerjaan layanan harus memiliki kontribusi tepat 100%.',
        variant: 'warning',
      });
      return;
    }

    const representative = units[0];
    if (!representative) return;
    try {
      const updated = await workspace.setQueuedAssignments(
        target.sale,
        target.line,
        representative.contributors.map((contributor) => contributor.employeeId),
        representative.contributors.map((contributor) => ({
          employeeId: contributor.employeeId,
          shareRate: contributor.shareRate,
        })),
      );
      setServiceWorkUnits((current) => ({ ...current, [serviceWorkKey(target.line)]: units }));
      setQueueDetail(updated);
      setServiceWorkTarget(null);
      showToast({
        title: 'Pengerjaan diperbarui',
        description: 'Pengaturan karyawan tersimpan untuk setiap pengerjaan layanan.',
        variant: 'success',
      });
    } catch {
      showToast({
        title: 'Gagal memperbarui pengerjaan',
        description: 'Pengaturan karyawan belum berubah. Coba lagi.',
        variant: 'danger',
      });
    }
  };
  const completeQueuedTransaction = (transaction: Sale) => {
    const issues = workflowIssues(transaction, serviceWorkUnits);
    if (issues.length) return;
    setCompletionConfirmationTarget(transaction);
  };
  const confirmQueuedCompletion = async () => {
    if (
      !completionConfirmationTarget ||
      workflowIssues(completionConfirmationTarget, serviceWorkUnits).length
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
        title: 'Transaksi selesai',
        description: `${transactionNumber(finalized.id)} telah diselesaikan.`,
        variant: 'success',
      });
    } catch {
      showToast({
        title: 'Gagal menyelesaikan transaksi',
        description: 'Periksa kembali status transaksi dan coba lagi.',
        variant: 'danger',
      });
    }
  };
  const openAdjustment = (transaction: Sale) => {
    if (transaction.status !== 'OPEN') return;
    setQueueDetail(null);
    setAdjustmentTarget(transaction);
    workspace.resumeSale(transaction.id);
  };
  const openQueuePayment = async (transaction: Sale) => {
    try {
      const { sale: hydrated, availableToPay } = await workspace.hydrateQueuedPayment(
        transaction.id,
      );
      setQueueDetail(null);
      setPaymentMethod('CASH');
      setProvider('');
      setTender(availableToPay);
      setQueuePaymentTarget(hydrated);
      setQueuePaymentAmount(availableToPay);
    } catch {
      showToast({
        title: 'Transaksi gagal dimuat',
        description: 'Muat ulang transaksi sebelum menerima pembayaran.',
        variant: 'danger',
      });
    }
  };
  const requestCancel = (transaction: Sale) => {
    if (hasSuccessfulPayment(transaction)) {
      showToast({
        title: 'Refund diperlukan',
        description:
          'Transaksi yang sudah menerima pembayaran tidak dapat dibatalkan tanpa proses refund.',
        variant: 'warning',
      });
      return;
    }
    setCancelTarget(transaction);
    setCancelReason('');
    workspace.resumeSale(transaction.id);
  };
  const confirmCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    if (hasSuccessfulPayment(cancelTarget)) {
      showToast({
        title: 'Refund diperlukan',
        description: 'Batalkan pembayaran terlebih dahulu melalui proses refund yang sesuai.',
        variant: 'warning',
      });
      return;
    }
    if (sale?.id !== cancelTarget.id) {
      workspace.resumeSale(cancelTarget.id);
      return;
    }
    try {
      const canceledSale = await workspace.voidSale();
      if (isLocalDemo) {
        writeCancellationReason(canceledSale.id, cancelReason.trim());
        setCancellationReasons((current) => ({
          ...current,
          [canceledSale.id]: cancelReason.trim(),
        }));
      }
      setQueueDetail(canceledSale);
      setCancelTarget(null);
      setCancelReason('');
      workspace.clearProcessedDraft();
      showToast({
        title: 'Transaksi dibatalkan',
        description: 'Alasan pembatalan telah dicatat.',
        variant: 'success',
      });
    } catch {
      showToast({
        title: 'Pembatalan gagal',
        description: 'Transaksi tetap tidak berubah. Periksa kembali status pembayaran.',
        variant: 'danger',
      });
    }
  };
  const completeCheckout = async (destination: FulfillmentDestination) => {
    if (!sale || !lines.length) return;

    if (!payNow) {
      commitCheckoutToQueue(sale, false, destination);
      if (destination === 'START_PROCESS') await startQueuedWork(sale);
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
          title: 'Checkout belum selesai',
          description: 'Pembayaran belum berhasil diselesaikan. Cart tetap tersedia.',
          variant: 'warning',
        });
        return;
      }
      commitCheckoutToQueue(completedSale, true, destination);
      if (destination === 'START_PROCESS') await startQueuedWork(completedSale);
    } catch {
      showToast({
        title: 'Checkout gagal',
        description: 'Pembayaran belum berhasil diproses. Cart tidak diubah.',
        variant: 'danger',
      });
    }
  };
  const payQueueBalance = async () => {
    const transaction = displayedQueuePaymentTarget;
    if (!transaction || sale?.id !== transaction.id || !queuePaymentAmount) return;
    const due = queuePaymentAmount;
    const applied = paymentMethod === 'CASH' ? tender || due : due;
    if (!isPositiveDecimal(applied)) return;
    if (paymentMethod === 'CASH' && createDecimal(applied).lessThan(createDecimal(due))) return;
    if ((paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'WALLET') && !provider) return;
    try {
      const updatedSale = await workspace.createPayment(
        paymentMethod,
        due,
        paymentMethod === 'CASH' ? applied : undefined,
        provider || undefined,
      );
      setQueuePaymentTarget(null);
      setQueuePaymentAmount(null);
      setQueueDetail(updatedSale);
      setReceiptSaleId(updatedSale.id);
      workspace.clearProcessedDraft();
      showToast({
        title: hasSuccessfulCheckout(updatedSale)
          ? 'Pembayaran lunas'
          : 'Pembayaran berhasil dicatat',
        description: 'Status operasional transaksi tidak berubah.',
        variant: 'success',
      });
    } catch {
      showToast({
        title: 'Pembayaran gagal',
        description: 'Saldo transaksi tidak berubah dan antrian tetap dipertahankan.',
        variant: 'danger',
      });
    }
  };
  const quickTender = ['50000', '100000', '150000', '200000', '500000'];
  const effectiveTender = tender || total;
  const cashShort =
    paymentMethod === 'CASH' && createDecimal(effectiveTender).lessThan(createDecimal(total));
  const change = cashShort
    ? '0.0000'
    : createDecimal(effectiveTender).minus(createDecimal(total)).toFixed(4);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-3 pb-3 pt-3 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5">
      {workspace.notice ? (
        <div
          role="alert"
          className="mb-3 flex shrink-0 flex-col gap-3 rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 gap-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
            <div>
              <p className="font-semibold">Transaction attention</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{workspace.notice}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {workspace.canRetryLastCommand ? (
              <Button size="sm" variant="outline" onClick={workspace.retryLastCommand}>
                <RotateCcw className="mr-1.5 size-3.5" /> Retry same command
              </Button>
            ) : null}
            {workspace.viewModel.primaryMode === 'CONFLICT_REVIEW' ? (
              <Button size="sm" variant="outline" onClick={workspace.acknowledgeLatestState}>
                <CheckCircle2 className="mr-1.5 size-3.5" /> Reviewed
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
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

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 pb-2">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-2 lg:flex-nowrap">
            <div className="grid shrink-0 grid-cols-2 rounded-xl bg-[var(--color-surface-muted)]/75 p-1 sm:inline-flex sm:items-center">
              <ReferenceTypeButton
                active={workspace.itemType === 'PRODUCT'}
                icon={<ShoppingBag className="size-3.5" />}
                label="Produk"
                onClick={() => selectType('PRODUCT')}
              />
              <ReferenceTypeButton
                active={workspace.itemType === 'SERVICE'}
                icon={<Wrench className="size-3.5" />}
                label="Jasa"
                onClick={() => selectType('SERVICE')}
              />
            </div>
            <div className="shrink-0">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Cari item..."
                debounceMs={0}
                expandedWidth="min(280px, calc(100vw - 140px))"
              />
            </div>
            <div className="hidden h-6 w-px bg-[var(--color-border)] lg:block" aria-hidden="true" />
            <div className="order-3 min-w-0 flex-1 basis-full lg:order-none lg:basis-0">
              <div className="no-scrollbar flex h-9 items-center gap-1.5 overflow-x-auto border-l border-[var(--color-border)]/70 pl-2 lg:border-l-0 lg:pl-0">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className={`inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold transition-colors ${selectedCategory ? 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]' : 'bg-[var(--color-brand)] text-white'}`}
                >
                  Semua
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className={`inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold transition-colors ${selectedCategory === category.id ? 'bg-[var(--color-brand)] text-white' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}
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
              Tidak ada item ditemukan
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
        isEstimate={workspace.cart.isLocalDraft}
        locale={workspace.locale}
        customer={cartCustomer}
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
        customer={cartCustomer}
        onClose={() => setCustomerPickerOpen(false)}
        onChoose={(customer) => {
          setCartCustomer(customer);
          setCustomerPickerOpen(false);
        }}
        onUseGeneralCustomer={() => {
          setCartCustomer(null);
          setCustomerPickerOpen(false);
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
        locale={workspace.locale}
        customer={cartCustomer}
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
        onStartProcess={() => void completeCheckout('START_PROCESS')}
      />
      <ReferenceTransactionDetail
        sale={displayedQueueDetail}
        locale={workspace.locale}
        employees={workspace.employees}
        businessName={runtime.branding.businessName ?? runtime.branding.productName}
        branchName="Main Branch"
        cashierName={session.identity.displayName}
        isLocalDemo={isLocalDemo}
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
          setCartCustomer(null);
          writeStoredCustomer(CURRENT_CUSTOMER_KEY, null);
          setCartOpen(false);
          workspace.newSale();
        }}
        onViewReceipt={(transaction) => {
          setQueueDetail(transaction);
          setReceiptSaleId(transaction.id);
        }}
        onAssign={(line) => {
          if (!displayedQueueDetail) return;
          workspace.requestEmployeeOptions();
          setQueueAssignmentTarget({ sale: displayedQueueDetail, line });
        }}
        serviceWorkUnits={serviceWorkUnits}
        onManageServiceWork={(line) => {
          if (!displayedQueueDetail) return;
          workspace.requestEmployeeOptions();
          setServiceWorkTarget({ sale: displayedQueueDetail, line });
        }}
        onComplete={() => {
          if (displayedQueueDetail) void completeQueuedTransaction(displayedQueueDetail);
        }}
        isMutating={workspace.isCoreMutating}
      />
      <ReferenceOrderAdjustmentDialog
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
          workspace.clearProcessedDraft();
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
          workspace.clearProcessedDraft();
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
        title="Selesaikan transaksi"
        message={
          completionConfirmationTarget
            ? `Selesaikan transaksi ${transactionNumber(completionConfirmationTarget.id)}? Tindakan ini menutup pekerjaan yang sudah selesai.`
            : undefined
        }
        confirmLabel="Selesaikan"
        cancelLabel="Batal"
        variant="primary"
        loading={workspace.isCoreMutating}
      />
      <ReferenceCancelDialog
        sale={cancelTarget}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
      />
      <ReferenceEmployeeDialog
        key={assignmentLine?.id ?? 'closed'}
        line={assignmentLine}
        employees={workspace.employees}
        locale={workspace.locale}
        onClose={() => {
          setAssignmentLine(null);
        }}
        onSave={(employeeIds, contributors) => {
          if (!assignmentLine) return;
          workspace.setAssignments(assignmentLine, employeeIds);
          if (assignmentLine.allowEmployeeContributionSnapshot)
            workspace.setContributions(assignmentLine, contributors);
          setAssignmentLine(null);
        }}
      />
      <ReferenceServiceWorkDialog
        key={
          serviceWorkTarget
            ? `${serviceWorkTarget.sale.id}:${serviceWorkTarget.line.id}`
            : 'service-work-closed'
        }
        line={serviceWorkTarget?.line ?? null}
        employees={workspace.employees}
        locale={workspace.locale}
        units={
          serviceWorkTarget
            ? serviceWorkUnitsFor(
                serviceWorkTarget.line,
                serviceWorkUnits[serviceWorkKey(serviceWorkTarget.line)],
              )
            : []
        }
        onClose={() => setServiceWorkTarget(null)}
        onSave={(units) => {
          if (serviceWorkTarget) void saveServiceWorkUnits(serviceWorkTarget, units);
        }}
      />
      <ReferenceEmployeeDialog
        key={
          queueAssignmentTarget
            ? `${queueAssignmentTarget.sale.id}:${queueAssignmentTarget.line.id}`
            : 'queue-assignment-closed'
        }
        line={queueAssignmentTarget?.line ?? null}
        employees={workspace.employees}
        locale={workspace.locale}
        onClose={() => setQueueAssignmentTarget(null)}
        onSave={(employeeIds, contributors) => {
          const target = queueAssignmentTarget;
          if (!target) return;
          void workspace
            .setQueuedAssignments(target.sale, target.line, employeeIds, contributors)
            .then((updated) => {
              setQueueDetail(updated);
              setQueueAssignmentTarget(null);
              showToast({
                title: 'Karyawan diperbarui',
                description: 'Penugasan layanan tersimpan pada transaksi yang sedang dikerjakan.',
                variant: 'success',
              });
            })
            .catch(() => {
              showToast({
                title: 'Gagal memperbarui karyawan',
                description: 'Penugasan belum berubah. Coba lagi.',
                variant: 'danger',
              });
            });
        }}
      />
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
  const isService = item.type === 'SERVICE';
  return (
    <button
      type="button"
      aria-label={`Add ${item.name}`}
      disabled={disabled}
      onClick={onAdd}
      className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition-all hover:border-[var(--color-brand)]/40 hover:shadow-md active:scale-[.98] disabled:opacity-50"
    >
      <div
        className={`mb-2 flex aspect-square w-full items-center justify-center rounded-xl ${isService ? 'bg-cyan-500/10 text-cyan-600' : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'}`}
      >
        {isService ? <Wrench className="size-7" /> : <ShoppingBag className="size-7" />}
      </div>
      <p className="truncate font-mono text-[10px] text-[var(--color-text-muted)]">{item.code}</p>
      <p className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-tight">{item.name}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-text-muted)]">
          {price ? money(price, locale) : 'Harga saat dipilih'}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isService ? 'bg-cyan-500/10 text-cyan-700' : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'}`}
        >
          {isService ? 'Jasa' : 'Produk'}
        </span>
      </div>
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
  const statuses = Object.keys(statusMeta) as QueueStatus[];
  const count = groups.QUEUED.length + groups.PROGRESS.length;
  const list = groups[active];
  const contentKey = `${active}:${list.map((sale) => `${sale.id}:${sale.version}`).join('|')}`;
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
                <p className="text-sm font-bold">Transaksi Antrian</p>
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-bold ${count ? 'bg-[var(--color-brand)] text-white' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}
                >
                  {count}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                {count
                  ? 'Klik untuk melihat transaksi yang sedang berjalan.'
                  : 'Belum ada transaksi antrian.'}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {statuses.map((status) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold ${statusMeta[status].tone}`}
              >
                {statusMeta[status].icon}
                {statusMeta[status].label}
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
        <div
          className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="overflow-hidden">
            <div
              key={contentKey}
              className="pos-queue-content-enter space-y-3 border-t border-[var(--color-border)] p-3"
            >
              <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
                {statuses.map((status) => {
                  const meta = statusMeta[status];
                  const selected = status === active;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => onChangeTab(status)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold transition-all active:scale-[.98] ${selected ? 'bg-[var(--color-background)] text-[var(--color-text)] shadow-sm ring-1 ring-[var(--color-border)]' : 'border-transparent bg-[var(--color-surface-muted)]/45 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'}`}
                    >
                      <span
                        className={`inline-flex size-6 items-center justify-center rounded-full ${selected ? meta.tone : 'bg-[var(--color-background)] text-[var(--color-text-muted)]'}`}
                      >
                        {meta.icon}
                      </span>
                      <span>{meta.label}</span>
                      <span
                        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${selected ? meta.tone : 'bg-[var(--color-background)] text-[var(--color-text-muted)]'}`}
                      >
                        {groups[status].length}
                      </span>
                    </button>
                  );
                })}
              </div>
              {list.length ? (
                <div className="no-scrollbar cursor-grab overflow-x-auto overflow-y-hidden pb-3 select-none">
                  <div className="flex w-max gap-4 px-0.5">
                    {list.map((sale) => (
                      <ReferenceQueueCard
                        key={sale.id}
                        sale={sale}
                        status={active}
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
                    Tidak ada transaksi {statusMeta[active].label.toLowerCase()}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Transaksi akan muncul di sini ketika sudah dibuat.
                  </p>
                </div>
              )}
            </div>
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
  const meta = statusMeta[status];
  const { balanceDue } = financialSummary(sale);
  const hasPayment = hasSuccessfulPayment(sale);
  const paid = hasSuccessfulCheckout(sale);
  const customer = saleCustomer(sale.id);
  const actionItems = [
    { label: 'Preview / Detail', icon: <Eye className="size-3.5" />, onSelect: () => onView(sale) },
    ...(hasPayment
      ? [
          {
            label: 'Lihat Struk',
            icon: <Printer className="size-3.5" />,
            onSelect: () => onViewReceipt(sale),
          },
        ]
      : []),
    ...(status === 'QUEUED'
      ? [
          {
            label: 'Mulai Pekerjaan',
            icon: <PlayCircle className="size-3.5" />,
            onSelect: () => onStartWork(sale),
          },
          {
            label: 'Sesuaikan Pesanan',
            icon: <ShoppingBag className="size-3.5" />,
            onSelect: () => onAdjust(sale),
          },
          ...(isPositiveDecimal(balanceDue)
            ? [
                {
                  label: hasPayment ? 'Bayar Sisa' : 'Bayar',
                  icon: <CreditCard className="size-3.5" />,
                  onSelect: () => onPay(sale),
                },
              ]
            : []),
          {
            label: 'Batalkan',
            icon: <XCircle className="size-3.5" />,
            destructive: true,
            onSelect: () => onCancel(sale),
          },
        ]
      : []),
    ...(status === 'PROGRESS'
      ? [
          ...(isPositiveDecimal(balanceDue)
            ? [
                {
                  label: hasPayment ? 'Bayar Sisa' : 'Bayar',
                  icon: <CreditCard className="size-3.5" />,
                  onSelect: () => onPay(sale),
                },
              ]
            : []),
          {
            label: 'Batalkan',
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
            {transactionNumber(sale.id)}
          </p>
          <p className="mt-0.5 truncate text-sm font-bold">{customer.name || 'Umum'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${paid ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'}`}
          >
            {paid ? 'Lunas' : hasPayment ? 'Bayar Sebagian' : 'Belum Bayar'}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${meta.tone}`}
          >
            {meta.icon}
            {meta.label}
          </span>
        </div>
      </div>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {sale.lines.filter((line) => !line.removedAt).length} item ·{' '}
            {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(
              new Date(sale.createdAt),
            )}
          </p>
          <p className="mt-1 text-sm font-bold text-[var(--color-brand)]">
            {money(sale.totalAmount, locale)}
          </p>
        </div>
        <Dropdown
          placement="bottom-end"
          contentRole="menu"
          closeOnItemClick
          contentClassName="min-w-[172px] overflow-hidden p-1"
          trigger={({ open }) => (
            <button
              type="button"
              aria-label={`Actions for ${transactionNumber(sale.id)}`}
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
      {issues.length ? (
        <div className="mt-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-xs">
          <p className="font-semibold text-[var(--color-warning)]">Lengkapi sebelum mulai</p>
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
  isEstimate: boolean;
  locale: string;
  customer: PosCustomer | null;
  onChooseCustomer: () => void;
  onQuantity: (line: CartDisplayLine, quantity: string) => void;
  onRemove: (line: CartDisplayLine) => void;
  onCheckout: () => void;
}) {
  const panel = (
    <ReferenceCartPanel
      lines={lines}
      total={total}
      gross={gross}
      isEstimate={isEstimate}
      locale={locale}
      customer={customer}
      onChooseCustomer={onChooseCustomer}
      onQuantity={onQuantity}
      onRemove={onRemove}
      onCheckout={onCheckout}
    />
  );
  return (
    <>
      <button
        type="button"
        aria-label="Close active cart"
        onClick={() => onOpenChange(false)}
        className={`fixed inset-0 z-40 hidden bg-transparent md:block ${open ? '' : 'pointer-events-none opacity-0'}`}
      />
      <button
        type="button"
        aria-label="Cart"
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
        <div className="hidden text-left sm:block">
          <p className="text-xs font-bold leading-none">Cart</p>
          <p className="mt-1 text-[11px] opacity-90">{money(total, locale)}</p>
        </div>
      </button>
      <div
        role="dialog"
        aria-label="Cart"
        className={`fixed bottom-6 right-6 z-50 hidden max-h-[calc(100dvh-48px)] w-[420px] max-w-[calc(100vw-48px)] origin-bottom-right flex-col overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-background)] shadow-[0_24px_70px_rgb(15_23_42_/_0.22)] transition-all duration-200 ease-out md:flex ${open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-4 scale-95 opacity-0'}`}
      >
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Cart</h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                {lines.length ? `${lines.length} item dipilih` : 'Belum ada item dipilih'}
              </p>
            </div>
            <button
              type="button"
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
        aria-label="Cart"
        className={`fixed inset-x-0 bottom-0 z-50 h-[86dvh] overflow-hidden rounded-t-[28px] border-t border-[var(--color-border)] bg-[var(--color-background)] shadow-[0_-24px_80px_rgb(15_23_42_/_0.25)] transition-transform duration-300 ease-out md:hidden ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Cart</h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {lines.length ? `${lines.length} item dipilih` : 'Belum ada item dipilih'}
                </p>
              </div>
              <button
                type="button"
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
  isEstimate: boolean;
  locale: string;
  customer: PosCustomer | null;
  onChooseCustomer: () => void;
  onQuantity: (line: CartDisplayLine, quantity: string) => void;
  onRemove: (line: CartDisplayLine) => void;
  onCheckout: () => void;
}) {
  const status = customerStatus(customer);
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
          aria-label="Choose customer"
          onClick={onChooseCustomer}
          className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/45 px-3 py-2.5 text-left transition-colors hover:border-[var(--color-brand)]/35 hover:bg-[var(--color-brand)]/5"
        >
          <div className="grid size-8 place-items-center rounded-xl bg-[var(--color-background)] text-[var(--color-text-muted)]">
            <User className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-xs font-semibold">{customer?.name ?? 'Pelanggan umum'}</p>
              <Badge variant={status.variant} className="shrink-0 px-2 py-0 text-[10px]">
                {status.label}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
              {customer?.phone ?? 'Pilih pelanggan untuk transaksi ini'}
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
            {lines.map((line) => (
              <div
                key={line.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">
                      {line.itemNameSnapshot}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                      {money(line.effectiveUnitPrice, locale)}
                      {line.variantNameSnapshot ? ` · ${line.variantNameSnapshot}` : ''}
                      {line.itemTypeSnapshot === 'SERVICE' ? (
                        <span className="ml-1 font-semibold text-cyan-700">· Jasa</span>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${line.itemNameSnapshot}`}
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
                      aria-label={`Decrease ${line.itemNameSnapshot} quantity`}
                      onClick={() => increment(line, 'down')}
                      disabled={createDecimal(line.quantity).lessThanOrEqualTo(createDecimal('1'))}
                      className="flex h-9 items-center justify-center border-r border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] active:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--color-text-muted)]"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <output
                      aria-label={`Quantity for ${line.itemNameSnapshot}`}
                      className="flex h-9 w-12 items-center justify-center text-xs font-bold tabular-nums text-[var(--color-text)]"
                    >
                      {quantity(line.quantity)}
                    </output>
                    <button
                      type="button"
                      aria-label={`Increase ${line.itemNameSnapshot} quantity`}
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
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <ShoppingBag className="size-[22px]" />
            </div>
            <p className="text-sm font-semibold">Cart masih kosong</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Pilih produk atau jasa dari katalog.
            </p>
          </div>
        )}
      </div>
      <div className="shrink-0 bg-[var(--color-background)] p-4">
        <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">
              {isEstimate ? 'Estimasi subtotal' : 'Subtotal'}
            </span>
            <span className="font-medium">{money(gross, locale)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
            <span className="text-sm font-bold">{isEstimate ? 'Estimasi total' : 'Total'}</span>
            <span className="text-lg font-bold text-[var(--color-brand)]">
              {money(total, locale)}
            </span>
          </div>
          <Button
            fullWidth
            disabled={!lines.length}
            onClick={onCheckout}
            leftIcon={<CreditCard className="size-3.5" />}
          >
            Checkout
          </Button>
          {lines.length ? (
            <p className="text-center text-[11px] text-[var(--color-text-muted)]">
              Harga dan total otoritatif dikonfirmasi saat Checkout.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReferenceCustomerDialog({
  open,
  customer,
  onClose,
  onChoose,
  onUseGeneralCustomer,
}: {
  open: boolean;
  customer: PosCustomer | null;
  onClose: () => void;
  onChoose: (customer: PosCustomer) => void;
  onUseGeneralCustomer: () => void;
}) {
  const [mode, setMode] = useState<'MEMBER' | 'NON_MEMBER'>('MEMBER');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberCustomerLookupResult | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const memberResults = useMemo(
    () => customerMemberLookup.searchMembers(memberSearch),
    [memberSearch],
  );
  const chooseNonMember = () => {
    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();
    if (!normalizedName || !normalizedPhone) return;
    onChoose({ name: normalizedName, phone: normalizedPhone });
    setName('');
    setPhone('');
  };
  const changeMode = (nextMode: 'MEMBER' | 'NON_MEMBER') => {
    setMode(nextMode);
    setSelectedMember(null);
    setMemberSearch('');
  };

  return (
    <DDialog
      title="Pilih pelanggan"
      description="Hanya untuk konteks transaksi ini."
      open={open}
      onClose={onClose}
      ariaLabel="Choose customer"
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-md overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
    >
      <div className="min-h-0 space-y-3 overflow-y-auto">
        <button
          type="button"
          onClick={onUseGeneralCustomer}
          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${customer === null ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5' : 'border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]'}`}
        >
          <div className="grid size-8 place-items-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
            <User className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Gunakan pelanggan umum</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              Lanjutkan tanpa memilih pelanggan.
            </p>
          </div>
          {customer === null ? <CheckCircle2 className="size-4 text-[var(--color-brand)]" /> : null}
        </button>
        <div className="border-t border-[var(--color-border)] pt-3">
          <div className="flex gap-2" aria-label="Customer type">
            <Button
              size="sm"
              variant={mode === 'MEMBER' ? 'primary' : 'secondary'}
              onClick={() => changeMode('MEMBER')}
            >
              Member
            </Button>
            <Button
              size="sm"
              variant={mode === 'NON_MEMBER' ? 'primary' : 'secondary'}
              onClick={() => changeMode('NON_MEMBER')}
            >
              Non-member
            </Button>
          </div>

          {mode === 'MEMBER' ? (
            <div className="mt-3 space-y-3">
              <DCombobox
                key="member-search"
                ariaLabel="Search members by name or phone"
                value={selectedMember?.customerId ?? ''}
                options={memberResults.map((member) => ({
                  value: member.customerId,
                  label: member.name,
                  detail: `${member.phone} · ${member.membership.memberCode}`,
                }))}
                onChange={(customerId) => {
                  setSelectedMember(
                    memberResults.find((member) => member.customerId === customerId) ?? null,
                  );
                }}
                onSearchChange={(query) => {
                  setMemberSearch(query);
                  setSelectedMember(null);
                }}
                placeholder="Cari nama atau nomor telepon"
                idleMessage="Ketik nama, nomor telepon, atau kode member untuk mencari."
                renderEmpty={() => 'Member tidak ditemukan.'}
                renderOption={(option) => {
                  const member = memberResults.find(
                    (result) => result.customerId === String(option.value),
                  );
                  return (
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {member ? (
                        <span className="mt-0.5 block truncate text-xs font-normal text-[var(--color-text-muted)]">
                          {member.phone} · {member.membership.memberCode}
                        </span>
                      ) : null}
                    </span>
                  );
                }}
              />
              <Button
                fullWidth
                disabled={!selectedMember}
                onClick={() => selectedMember && onChoose(selectedMember)}
              >
                Gunakan pelanggan
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <DInput
                aria-label="Customer name"
                label="Nama"
                value={name}
                onChange={setName}
                placeholder="Nama pelanggan"
              />
              <DInput
                aria-label="Customer phone"
                label="Nomor telepon"
                value={phone}
                onChange={setPhone}
                placeholder="Nomor telepon"
                inputMode="tel"
              />
              <Button fullWidth disabled={!name.trim() || !phone.trim()} onClick={chooseNonMember}>
                Gunakan pelanggan
              </Button>
            </div>
          )}
        </div>
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
  onStartProcess,
}: {
  open: boolean;
  onClose: () => void;
  lines: readonly CartDisplayLine[];
  total: string;
  gross: string;
  discountAmount: string;
  locale: string;
  customer: PosCustomer | null;
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
  onStartProcess: () => void;
}) {
  const isCash = method === 'CASH';
  const needsProvider = method === 'BANK_TRANSFER' || method === 'WALLET';
  const canPay =
    lines.length > 0 && !isCashShort && (!needsProvider || Boolean(provider)) && !isSubmitting;
  const canConfirm = payNow ? canPay : lines.length > 0 && !isSubmitting;
  const methods: Array<{ value: PaymentMethod; label: string; icon: ReactNode }> = [
    { value: 'CASH', label: 'Tunai', icon: <Banknote className="size-[15px]" /> },
    { value: 'BANK_TRANSFER', label: 'Transfer', icon: <CreditCard className="size-[15px]" /> },
    { value: 'QRIS', label: 'QRIS', icon: <QrCode className="size-[15px]" /> },
    { value: 'WALLET', label: 'E-Wallet', icon: <ShoppingBag className="size-[15px]" /> },
  ];
  const providerOptions =
    method === 'BANK_TRANSFER'
      ? ['BCA', 'Mandiri', 'BRI', 'BNI']
      : ['DANA', 'GoPay', 'OVO', 'ShopeePay'];
  return (
    <DDialog
      title="Checkout pembayaran"
      description="Review transaksi dan pembayaran sebelum masuk antrian."
      open={open}
      onClose={onClose}
      ariaLabel="Checkout payment"
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-lg overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex shrink-0 flex-col-reverse justify-end gap-2 sm:flex-row">
          <DButton variant="ghost" onClick={onClose}>
            Batal
          </DButton>
          <DButton
            variant="outline"
            disabled={!canConfirm}
            loading={isSubmitting}
            onClick={onQueue}
          >
            Masuk Antrian
          </DButton>
          <DButton
            disabled={!canConfirm}
            loading={isSubmitting}
            onClick={onStartProcess}
            leftIcon={<CheckCircle2 className="size-3.5" />}
          >
            Lanjut Proses
          </DButton>
        </div>
      }
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Total Pembayaran</p>
              <h3 className="mt-0.5 text-2xl font-bold leading-tight text-[var(--color-brand)]">
                {money(total, locale)}
              </h3>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-xs text-[var(--color-text-muted)]">Pelanggan</p>
              <p className="max-w-[170px] truncate text-sm font-semibold">
                {customer?.name ?? 'Pelanggan umum'}
              </p>
              <Badge
                variant={customerStatus(customer).variant}
                className="mt-1 px-2 py-0 text-[10px]"
              >
                {customerStatus(customer).label}
              </Badge>
              <p className="text-[11px] text-[var(--color-text-muted)]">{lines.length} item</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-[var(--color-surface-muted)]/60 px-3 py-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Subtotal</span>
              <span className="font-semibold">{money(gross, locale)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[var(--color-text-muted)]">Diskon transaksi</span>
              <span className="font-semibold">{money(discountAmount, locale)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-[var(--color-border)] pt-2 text-sm">
              <span className="font-bold">Grand total</span>
              <span className="font-bold text-[var(--color-brand)]">{money(total, locale)}</span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Promo</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Promo akan dihitung dan divalidasi oleh sistem saat kapabilitas backend tersedia.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--color-surface-muted)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
              Belum tersedia
            </span>
          </div>
        </div>
        {customer?.membership ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Gunakan poin member</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Saldo, nilai penukaran, dan kelayakan poin akan divalidasi oleh sistem.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--color-surface-muted)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
                Opsional
              </span>
            </div>
          </div>
        ) : null}
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Detail Pesanan
            </p>
            <span className="text-xs text-[var(--color-text-muted)]">{lines.length} item</span>
          </div>
          <div className="max-h-[120px] divide-y divide-[var(--color-border)] overflow-y-auto">
            {lines.map((line) => (
              <div key={line.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{line.itemNameSnapshot}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
                      {line.itemTypeSnapshot === 'SERVICE' ? (
                        <span className="ml-1 font-semibold text-[var(--color-brand)]">· Jasa</span>
                      ) : null}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold">{money(line.totalAmount, locale)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 px-1 py-1.5">
          <span className="mt-0.5 shrink-0">
            <DCheckbox
              checked={payNow}
              onChange={(event) => onPayNowChange(event.target.checked)}
            />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Bayar sekarang</span>
            <span className="mt-0.5 block text-xs leading-4 text-[var(--color-text-muted)]">
              {payNow
                ? 'Pilih metode pembayaran sebelum transaksi diteruskan.'
                : 'Pembayaran dicatat setelah transaksi dibuat.'}
            </span>
          </span>
        </label>
        {payNow ? (
          <>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Metode Pembayaran
              </p>
              <div className="grid grid-cols-4 gap-2">
                {methods.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onMethod(option.value)}
                    className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-[.98] ${method === option.value ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white shadow-sm' : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'}`}
                  >
                    {option.icon}
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                ))}
              </div>
              {needsProvider ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold text-[var(--color-text-muted)]">
                    Pilih {method === 'BANK_TRANSFER' ? 'Bank' : 'E-Wallet'}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {providerOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onProvider(option)}
                        className={`h-9 rounded-xl border text-xs font-semibold transition-all active:scale-[.98] ${provider === option ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'}`}
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
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Pembayaran QRIS akan dicatat sebagai pembayaran berhasil untuk transaksi ini.
                  </p>
                </div>
              ) : null}
            </div>
            {isCash ? (
              <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                <label className="block text-sm font-medium">
                  Uang dibayar
                  <div className="relative mt-1.5">
                    <PosCurrencyInput
                      aria-label="Cash tendered"
                      className="h-10 rounded-lg bg-[var(--color-surface)] text-right text-lg font-bold"
                      value={tender}
                      onChange={onTender}
                    />
                  </div>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[total, ...quickTender]
                    .filter((amount, index, list) => list.indexOf(amount) === index)
                    .slice(0, 6)
                    .map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => onTender(amount)}
                        className={`h-9 rounded-lg border text-[11px] font-semibold transition-all active:scale-[.98] ${tender === amount ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-surface-muted)]'}`}
                      >
                        {money(amount, locale)}
                      </button>
                    ))}
                </div>
                <div
                  className={`flex items-center justify-between rounded-xl px-3 py-2 ${isCashShort ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'}`}
                >
                  <span className="text-sm font-bold">
                    {isCashShort ? 'Pembayaran kurang' : 'Kembalian'}
                  </span>
                  <span className="text-sm font-bold">
                    {isCashShort
                      ? money(
                          createDecimal(total)
                            .minus(createDecimal(tender || '0'))
                            .toFixed(4),
                          locale,
                        )
                      : money(change, locale)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/5 p-3">
                <p className="text-sm font-bold text-[var(--color-brand)]">
                  Pembayaran{' '}
                  {method === 'BANK_TRANSFER'
                    ? 'Transfer'
                    : method === 'WALLET'
                      ? 'E-Wallet'
                      : 'QRIS'}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Pilih provider bila diperlukan, lalu catat pembayaran ini.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </DDialog>
  );
}

function ReferenceTransactionDetail({
  sale,
  locale,
  employees,
  businessName,
  branchName,
  cashierName,
  isLocalDemo,
  cancellationReason,
  showPaymentReceipt,
  onClose,
  onViewReceipt,
  onAssign,
  serviceWorkUnits,
  onManageServiceWork,
  onComplete,
  isMutating,
}: {
  sale: Sale | null;
  locale: string;
  employees: readonly Employee[];
  businessName: string;
  branchName: string;
  cashierName: string;
  isLocalDemo: boolean;
  cancellationReason?: string;
  showPaymentReceipt: boolean;
  onClose: () => void;
  onNewSale: () => void;
  onViewReceipt: (sale: Sale) => void;
  onAssign: (line: SaleLine) => void;
  serviceWorkUnits: ServiceWorkUnitsByLine;
  onManageServiceWork: (line: SaleLine) => void;
  onComplete: () => void;
  isMutating: boolean;
}) {
  const [receiptPaper, setReceiptPaper] = useState<'58' | '80'>('80');
  if (!sale) return null;
  const status = queueStatus(sale, isLocalDemo);
  const customerContext = readStoredCustomer(saleCustomerKey(sale.id));
  const customer = customerContext ?? saleCustomer(sale.id);
  const activeLines = sale.lines.filter((line) => !line.removedAt);
  const payments = successfulPayments(sale);
  const payment = payments[payments.length - 1] ?? null;
  const receiptAvailable = payments.length > 0;
  const showReceipt = showPaymentReceipt && receiptAvailable;
  const { totalPaid } = financialSummary(sale);
  const hasDiscount = !createDecimal(sale.discountAmount).equals(createDecimal('0'));
  const hasTax = !createDecimal(sale.taxAmount).equals(createDecimal('0'));
  const completionIssues = status === 'PROGRESS' ? workflowIssues(sale, serviceWorkUnits) : [];
  const completionIssueGroups = groupWorkflowIssues(sale, completionIssues);
  const transactionDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(sale.finalizedAt ?? sale.updatedAt));

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={showReceipt ? 'Preview struk pembayaran' : 'Detail transaksi'}
        description={transactionNumber(sale.id)}
        ariaLabel={showReceipt ? 'Receipt preview' : 'Transaction detail'}
        closeOnEscape
        closeOnOverlay
        noPadding
        className={`pos-reference-dialog max-h-[92dvh] w-full overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl ${showReceipt ? 'max-w-md' : 'max-w-lg'}`}
        footer={
          <div
            className={`flex shrink-0 flex-col-reverse justify-end gap-2 sm:flex-row ${showReceipt ? 'pos-receipt-actions' : ''}`}
          >
            <DButton variant="ghost" onClick={onClose}>
              Tutup
            </DButton>
            {!showReceipt && receiptAvailable ? (
              <DButton
                rightIcon={<Printer className="size-3.5" />}
                variant="outline"
                onClick={() => onViewReceipt(sale)}
              >
                Lihat Struk
              </DButton>
            ) : null}
            {!showReceipt && status === 'PROGRESS' ? (
              <DButton
                variant="primary"
                disabled={completionIssues.length > 0}
                loading={isMutating}
                leftIcon={<CheckCircle2 className="size-3.5" />}
                onClick={onComplete}
              >
                Selesaikan
              </DButton>
            ) : null}
            {showReceipt ? (
              <DButton
                rightIcon={<Printer className="size-3.5" />}
                variant="outline"
                onClick={() => window.print()}
              >
                Cetak
              </DButton>
            ) : null}
          </div>
        }
      >
        {showReceipt ? (
          <div className="flex max-h-[92dvh] min-h-0 flex-col px-5 py-4 sm:px-6">
            <div className="pos-receipt-preview-toolbar mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                Ukuran kertas
              </span>
              <div className="flex items-center gap-1.5" aria-label="Ukuran struk">
                <DButton
                  size="sm"
                  variant={receiptPaper === '58' ? 'primary' : 'secondary'}
                  onClick={() => setReceiptPaper('58')}
                >
                  58 mm
                </DButton>
                <DButton
                  size="sm"
                  variant={receiptPaper === '80' ? 'primary' : 'secondary'}
                  onClick={() => setReceiptPaper('80')}
                >
                  80 mm
                </DButton>
              </div>
            </div>
            <div
              className={`pos-receipt-preview pos-receipt-print--${receiptPaper} min-h-0 flex-1 overflow-y-auto bg-white text-slate-950`}
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
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
                <div className="bg-gradient-to-br from-[var(--color-brand)]/5 to-transparent px-5 py-4">
                  <p className="font-mono text-xs text-[var(--color-text-muted)]">
                    {transactionNumber(sale.id)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status ? statusMeta[status].tone : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}
                    >
                      {status ? statusMeta[status].label : 'Terbuka'}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${hasSuccessfulCheckout(sale) ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : receiptAvailable ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}
                    >
                      {hasSuccessfulCheckout(sale)
                        ? 'Lunas'
                        : receiptAvailable
                          ? 'Bayar sebagian'
                          : 'Belum dibayar'}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-[var(--color-text-muted)]">{transactionDate}</p>
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <span className="truncate font-semibold">{customer.name}</span>
                    <Badge
                      variant={customerStatus(customerContext).variant}
                      className="shrink-0 text-[10px]"
                    >
                      {customerStatus(customerContext).label}
                    </Badge>
                  </div>
                  {customer.membership ? (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {customer.membership.memberCode} · {customer.membership.status}
                    </p>
                  ) : customer.phone ? (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{customer.phone}</p>
                  ) : null}
                </div>
              </div>
              {sale.status === 'VOIDED' && cancellationReason ? (
                <div className="rounded-xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-3 py-2 text-xs">
                  <p className="font-semibold text-[var(--color-danger)]">Alasan pembatalan</p>
                  <p className="mt-1 text-[var(--color-text-muted)]">{cancellationReason}</p>
                </div>
              ) : null}
              {completionIssues.length ? (
                <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-xs">
                  <p className="font-semibold text-[var(--color-warning)]">
                    Belum siap diselesaikan
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
              <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
                <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                  <h3 className="text-sm font-semibold">Pesanan</h3>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {activeLines.length} item
                  </span>
                </header>
                <div className="min-h-[144px] max-h-[min(38dvh,360px)] flex-1 divide-y divide-[var(--color-border)] overflow-y-auto overscroll-contain">
                  {activeLines.map((line) => {
                    const isMultiUnitService =
                      line.itemTypeSnapshot === 'SERVICE' &&
                      line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
                      serviceWorkUnitCount(line) > 1;
                    const isTrackedService =
                      line.itemTypeSnapshot === 'SERVICE' &&
                      line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
                      line.fulfillment !== null;
                    const canEditServiceWork = isTrackedService && status === 'PROGRESS';
                    const requiresEmployeeAttribution =
                      line.employeeAssignmentModeSnapshot !== 'NONE' ||
                      line.allowEmployeeContributionSnapshot;
                    const employeeIssues = employeeAssignmentIssues(line);
                    if (isMultiUnitService) {
                      return (
                        <ReferenceServiceWorkLine
                          key={line.id}
                          line={line}
                          employees={employees}
                          locale={locale}
                          units={serviceWorkUnitsFor(line, serviceWorkUnits[serviceWorkKey(line)])}
                          active={status === 'PROGRESS'}
                          isMutating={isMutating}
                          onManage={() => onManageServiceWork(line)}
                        />
                      );
                    }
                    return (
                      <div key={line.id} className="p-4">
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{line.itemNameSnapshot}</p>
                            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                              {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
                              {line.variantNameSnapshot ? ` · ${line.variantNameSnapshot}` : ''}
                            </p>
                            {line.fulfillment ? (
                              <p className="mt-1 text-[11px] font-medium text-[var(--color-text-muted)]">
                                {line.fulfillment.status === 'WAITING'
                                  ? 'Menunggu proses'
                                  : line.fulfillment.status === 'IN_PROGRESS'
                                    ? 'Sedang diproses'
                                    : line.fulfillment.status === 'COMPLETED'
                                      ? 'Selesai'
                                      : 'Dibatalkan'}
                              </p>
                            ) : null}
                            {isTrackedService && requiresEmployeeAttribution ? (
                              <div className="mt-2 flex min-w-0 items-center gap-2 text-xs">
                                <span className="shrink-0 font-medium text-[var(--color-text-muted)]">
                                  Pengerjaan
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[var(--color-text-muted)]">
                                  {employeeWorkSummary(line, employees)}
                                </span>
                                {canEditServiceWork ? (
                                  employeeIssues.length > 0 ? (
                                    <DButton
                                      size="sm"
                                      variant="outline"
                                      disabled={isMutating}
                                      className="h-7 px-2 text-[11px]"
                                      onClick={() => onAssign(line)}
                                    >
                                      Atur
                                    </DButton>
                                  ) : (
                                    <DButton
                                      size="icon"
                                      variant="ghost"
                                      disabled={isMutating}
                                      aria-label={`Ubah pengerjaan ${line.itemNameSnapshot}`}
                                      onClick={() => onAssign(line)}
                                    >
                                      <Pencil className="size-3.5" />
                                    </DButton>
                                  )
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <p className="text-sm font-bold">{money(line.totalAmount, locale)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
            <ReferenceFinancialSummary sale={sale} locale={locale} />
          </div>
        )}
      </Dialog>
      {showReceipt
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
  customer: PosCustomer;
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
  return (
    <>
      <header className="text-center">
        <h2 className="text-lg font-black tracking-tight">{businessName}</h2>
        <p className="mt-1 text-xs text-slate-500">{branchName}</p>
        <div className="my-4 border-t border-dashed border-slate-300" />
        <p className="font-mono text-xs font-semibold">{transactionNumber(sale.id)}</p>
        <p className="mt-1 text-[11px] text-slate-500">{transactionDate}</p>
        <p className="mt-1 text-[11px] text-slate-500">Kasir: {cashierName}</p>
      </header>

      <section className="mt-4 text-xs">
        <p className="font-semibold">Pelanggan</p>
        <p className="mt-1">{customer.name}</p>
        {customer.phone ? <p className="text-slate-500">{customer.phone}</p> : null}
      </section>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <section className="space-y-2.5">
        {activeLines.map((line) => (
          <div key={line.id} className="text-xs leading-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">{line.itemNameSnapshot}</p>
                {line.variantNameSnapshot ? (
                  <p className="mt-0.5 text-slate-500">{line.variantNameSnapshot}</p>
                ) : null}
              </div>
              <p className="shrink-0 font-bold">{money(line.totalAmount, locale)}</p>
            </div>
            <p className="mt-1 text-slate-500">
              {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
            </p>
          </div>
        ))}
      </section>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Subtotal</dt>
          <dd>{money(sale.grossAmount, locale)}</dd>
        </div>
        {hasDiscount ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Diskon</dt>
            <dd>−{money(sale.discountAmount, locale)}</dd>
          </div>
        ) : null}
        {hasTax ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Pajak</dt>
            <dd>{money(sale.taxAmount, locale)}</dd>
          </div>
        ) : null}
        <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 text-sm font-black">
          <dt>TOTAL</dt>
          <dd>{money(sale.totalAmount, locale)}</dd>
        </div>
      </dl>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <section className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Dibayar</span>
          <span>{money(totalPaid, locale)}</span>
        </div>
        {payment?.method === 'CASH' ? (
          <>
            {payment.tenderedAmount ? (
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Uang diterima</span>
                <span>{money(payment.tenderedAmount, locale)}</span>
              </div>
            ) : null}
            {isPositiveDecimal(payment.changeAmount ?? '0') ? (
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Kembalian</span>
                <span>{money(payment.changeAmount ?? '0.0000', locale)}</span>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <div className="my-4 border-t border-dashed border-slate-300" />
      <p className="text-center text-[11px] text-slate-500">Terima kasih telah bertransaksi.</p>
      <div className="pos-receipt-tear" aria-hidden="true" />
    </>
  );
}

function ReferenceServiceWorkLine({
  line,
  employees,
  locale,
  units,
  active,
  isMutating,
  onManage,
}: {
  line: SaleLine;
  employees: readonly Employee[];
  locale: string;
  units: readonly ServiceWorkUnit[];
  active: boolean;
  isMutating: boolean;
  onManage: () => void;
}) {
  const employeeWorkSummary = serviceWorkAssignmentSummary(units, employees);

  return (
    <div className="p-4">
      <div className="flex justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{line.itemNameSnapshot}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
            {line.variantNameSnapshot ? ` · ${line.variantNameSnapshot}` : ''}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-[var(--color-text-muted)]">
              {units.length} unit · {employeeWorkSummary}
            </span>
            {active ? (
              <DButton
                size="icon"
                variant="ghost"
                disabled={isMutating}
                aria-label={`Ubah pengerjaan ${line.itemNameSnapshot}`}
                onClick={onManage}
              >
                <Pencil className="size-3.5" />
              </DButton>
            ) : null}
          </div>
        </div>
        <p className="shrink-0 text-sm font-bold">{money(line.totalAmount, locale)}</p>
      </div>
    </div>
  );
}

function ReferenceFinancialSummary({ sale, locale }: { sale: Sale; locale: string }) {
  const [expanded, setExpanded] = useState(false);
  const { totalPaid, balanceDue } = financialSummary(sale);
  const hasDiscount = !createDecimal(sale.discountAmount).equals(createDecimal('0'));
  const hasTax = !createDecimal(sale.taxAmount).equals(createDecimal('0'));
  const cashPayments = successfulPayments(sale).filter((payment) => payment.method === 'CASH');
  const cashTendered = cashPayments.reduce(
    (total, payment) => total.plus(createDecimal(payment.tenderedAmount ?? '0')),
    createDecimal('0'),
  );
  const cashChange = cashPayments.reduce(
    (total, payment) => total.plus(createDecimal(payment.changeAmount ?? '0')),
    createDecimal('0'),
  );
  const hasCashTendered = cashPayments.some((payment) => payment.tenderedAmount !== null);
  const hasCashChange = !cashChange.equals(createDecimal('0'));

  return (
    <section className="sticky bottom-0 z-10 flex shrink-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div
        className={`order-2 grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <dl className="space-y-1.5 border-b border-[var(--color-border)] px-5 py-3 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-muted)]">Subtotal</dt>
              <dd>{money(sale.grossAmount, locale)}</dd>
            </div>
            {hasDiscount ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-text-muted)]">Promo / diskon</dt>
                <dd>−{money(sale.discountAmount, locale)}</dd>
              </div>
            ) : null}
            {hasTax ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-text-muted)]">Pajak</dt>
                <dd>{money(sale.taxAmount, locale)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-2 font-semibold">
              <dt>Total</dt>
              <dd>{money(sale.totalAmount, locale)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-muted)]">Dibayar</dt>
              <dd>{money(totalPaid, locale)}</dd>
            </div>
            <div className="flex justify-between gap-3 font-semibold text-[var(--color-brand)]">
              <dt>Sisa</dt>
              <dd>{money(balanceDue, locale)}</dd>
            </div>
            {hasCashTendered ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-text-muted)]">Uang diterima</dt>
                <dd>{money(cashTendered.toFixed(4), locale)}</dd>
              </div>
            ) : null}
            {hasCashChange ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-text-muted)]">Kembalian</dt>
                <dd>{money(cashChange.toFixed(4), locale)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="order-1 grid w-full grid-cols-[1fr_1fr_1fr_auto] items-center gap-3 px-5 py-3 text-left text-xs transition-colors duration-200 hover:bg-[var(--color-surface-muted)]"
      >
        <span>
          <span className="block text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Total
          </span>
          <span className="mt-0.5 block font-semibold">{money(sale.totalAmount, locale)}</span>
        </span>
        <span>
          <span className="block text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Dibayar
          </span>
          <span className="mt-0.5 block font-semibold">{money(totalPaid, locale)}</span>
        </span>
        <span className="text-right">
          <span className="block text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Sisa
          </span>
          <span className="mt-0.5 block font-semibold text-[var(--color-brand)]">
            {money(balanceDue, locale)}
          </span>
        </span>
        <ChevronDown
          className={`size-4 text-[var(--color-text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
    </section>
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
  const [catalogSearch, setCatalogSearch] = useState('');
  const [variantSelection, setVariantSelection] = useState<{
    itemId: string;
    variantId: string;
  } | null>(null);
  const selectedVariantId =
    variantSelection && variantSelection.itemId === variantPicker?.item.id
      ? variantSelection.variantId
      : null;

  if (!sale) return null;

  const paid = hasSuccessfulPayment(sale);
  const activeLines = sale.lines.filter((line) => line.removedAt === null);
  const options = items
    .filter((item) => {
      const query = catalogSearch.trim().toLocaleLowerCase();
      return !query || `${item.name} ${item.code}`.toLocaleLowerCase().includes(query);
    })
    .slice(0, 12)
    .map((item) => ({
      value: item.id,
      label: `${item.name} · ${item.code}`,
    }));

  return (
    <Dialog
      open
      onClose={onClose}
      title="Sesuaikan Pesanan"
      description={`${transactionNumber(sale.id)} · perubahan tetap pada transaksi ini`}
      ariaLabel="Adjust queued transaction"
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={isMutating} onClick={onClose}>
            Konfirmasi penyesuaian
          </Button>
        </div>
      }
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {paid ? (
          <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-xs">
            <p className="font-semibold text-[var(--color-warning)]">
              Pembayaran sebelumnya dipertahankan
            </p>
            <p className="mt-1 text-[var(--color-text-muted)]">
              Anda dapat menambahkan item. Pengurangan atau penghapusan item berbayar memerlukan
              proses refund.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">
            Ubah qty atau hapus item yang belum dimulai, lalu konfirmasi penyesuaian.
          </p>
        )}
        <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
          {activeLines.map((line) => {
            const canDecrease =
              !paid && createDecimal(line.quantity).greaterThan(createDecimal('1'));
            return (
              <div key={line.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{line.itemNameSnapshot}</p>
                  {line.variantNameSnapshot ? (
                    <p className="mt-0.5 truncate text-xs font-medium text-[var(--color-text-muted)]">
                      {line.variantNameSnapshot}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Kurangi ${line.itemNameSnapshot}`}
                    disabled={!canDecrease || isMutating}
                    onClick={() =>
                      onQuantity(
                        line,
                        createDecimal(line.quantity).minus(createDecimal('1')).toFixed(4),
                      )
                    }
                    className="flex size-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-8 text-center text-xs font-semibold">
                    {quantity(line.quantity)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Tambah ${line.itemNameSnapshot}`}
                    disabled={isMutating}
                    onClick={() =>
                      onQuantity(
                        line,
                        createDecimal(line.quantity).plus(createDecimal('1')).toFixed(4),
                      )
                    }
                    className="flex size-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus ${line.itemNameSnapshot}`}
                    disabled={paid || isMutating}
                    onClick={() => onRemove(line)}
                    className="ml-1 flex size-8 items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Tambah item dari katalog
          </p>
          <Combobox
            ariaLabel="Tambah item ke transaksi"
            value={null}
            placeholder="Cari produk atau jasa"
            options={options}
            onSearchChange={setCatalogSearch}
            onChange={(itemId) => {
              const item = items.find((candidate) => candidate.id === itemId);
              if (item) onAdd(item);
            }}
            disabled={isMutating}
            idleMessage="Ketik nama atau kode item untuk menambahkan ke transaksi ini."
          />
        </div>
        {variantPicker ? (
          <section className="border-t border-[var(--color-border)] pt-3">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {variantPicker.item.name}
              </p>
              <Select
                label="Varian"
                value={selectedVariantId}
                placeholder="Pilih varian"
                options={variantPicker.variants.map((variant) => {
                  const price = variantPicker.pricesByVariantId?.[variant.id];
                  const isUnavailable =
                    variantPicker.unavailableVariantIds?.includes(variant.id) ?? false;
                  return {
                    value: variant.id,
                    label: isUnavailable
                      ? `${variant.name} · Harga belum tersedia`
                      : price
                        ? `${variant.name} · ${money(price, locale)}`
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
                  Tambahkan item
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
  if (!sale) return null;
  const { totalPaid } = financialSummary(sale);
  const balanceDue = availableToPay ?? '0.0000';
  const isCash = method === 'CASH';
  const needsProvider = method === 'BANK_TRANSFER' || method === 'WALLET';
  const applied = isCash ? tender || balanceDue : balanceDue;
  const cashShort = isCash && createDecimal(applied).lessThan(createDecimal(balanceDue));
  const canPay =
    isPositiveDecimal(applied) &&
    !cashShort &&
    (!needsProvider || Boolean(provider)) &&
    !isMutating;
  const methods: Array<{ value: PaymentMethod; label: string; icon: ReactNode }> = [
    { value: 'CASH', label: 'Tunai', icon: <Banknote className="size-4" /> },
    { value: 'BANK_TRANSFER', label: 'Transfer', icon: <CreditCard className="size-4" /> },
    { value: 'QRIS', label: 'QRIS', icon: <QrCode className="size-4" /> },
    { value: 'WALLET', label: 'E-Wallet', icon: <ShoppingBag className="size-4" /> },
  ];
  const providerOptions =
    method === 'BANK_TRANSFER'
      ? ['BCA', 'Mandiri', 'BRI', 'BNI']
      : ['DANA', 'GoPay', 'OVO', 'ShopeePay'];

  return (
    <Dialog
      open
      onClose={onClose}
      title={hasSuccessfulPayment(sale) ? 'Bayar Sisa' : 'Bayar Transaksi'}
      description={transactionNumber(sale.id)}
      ariaLabel="Pay queued transaction"
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-md overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!canPay} loading={isMutating} onClick={onPay}>
            Bayar {money(balanceDue, locale)}
          </Button>
        </div>
      }
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-sm">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Sudah dibayar</p>
            <p className="mt-1 font-semibold">{money(totalPaid, locale)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--color-text-muted)]">Tersedia dibayar</p>
            <p className="mt-1 font-bold text-[var(--color-brand)]">{money(balanceDue, locale)}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {methods.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onMethod(option.value)}
              className={`flex h-10 items-center justify-center gap-1 rounded-xl border text-xs font-semibold ${method === option.value ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'}`}
            >
              {option.icon}
              <span className="hidden sm:inline">{option.label}</span>
            </button>
          ))}
        </div>
        {needsProvider ? (
          <div className="grid grid-cols-4 gap-2">
            {providerOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onProvider(option)}
                className={`h-9 rounded-lg border text-xs font-semibold ${provider === option ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'}`}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
        {isCash ? (
          <label className="block text-sm font-medium">
            Uang dibayar
            <PosCurrencyInput
              aria-label="Cash tendered for queued transaction"
              className="mt-1.5 h-10 rounded-lg text-right text-lg font-bold"
              value={tender}
              onChange={onTender}
            />
            {cashShort ? (
              <span className="mt-1 block text-xs text-[var(--color-warning)]">
                Nominal pembayaran belum mencukupi.
              </span>
            ) : null}
          </label>
        ) : (
          <p className="rounded-xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/5 p-3 text-xs text-[var(--color-text-muted)]">
            Catat pembayaran{' '}
            {method === 'BANK_TRANSFER' ? 'transfer' : method === 'WALLET' ? 'e-wallet' : 'QRIS'}{' '}
            sebesar {money(balanceDue, locale)}.
          </p>
        )}
      </div>
    </Dialog>
  );
}

function ReferenceInfoTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
        {sub ? (
          <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ReferenceReviewDialog({
  sale,
  activeSale,
  locale,
  employees,
  issues,
  onClose,
  onFix,
  onAssign,
  onFulfillment,
  onComplete,
}: {
  sale: Sale | null;
  activeSale: Sale | null;
  locale: string;
  employees: readonly Employee[];
  issues: string[];
  onClose: () => void;
  onFix: () => void;
  onAssign: (line: SaleLine) => void;
  onFulfillment: (line: SaleLine, status: 'IN_PROGRESS' | 'COMPLETED') => void;
  onComplete: () => void;
}) {
  if (!sale) return null;
  const active = activeSale?.id === sale.id;
  const paid = sale.payments
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum.plus(createDecimal(payment.appliedAmount)), createDecimal('0'));
  const outstanding = createDecimal(sale.totalAmount).minus(paid);
  const name = (employeeId: string) =>
    employees.find((employee) => employee.id === employeeId)?.displayName ?? 'Karyawan';
  return (
    <Dialog
      open
      title="Review & Selesaikan"
      description="Pastikan semua detail transaksi sudah benar sebelum diselesaikan."
      onClose={onClose}
      ariaLabel="Review and complete transaction"
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-2xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <footer className="flex shrink-0 justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={!active || issues.length > 0}
            onClick={onComplete}
            leftIcon={<CheckCircle2 className="size-3.5" />}
          >
            {active ? 'Selesaikan Transaksi' : 'Memuat transaksi…'}
          </Button>
        </footer>
      }
    >
      <div className="flex flex-col">
        <div className="min-h-0 flex-1 space-y-4">
          {issues.length ? (
            <div className="rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-3">
              <p className="text-sm font-bold text-[var(--color-warning)]">
                Transaksi perlu dilengkapi
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[var(--color-text)]">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <Button size="sm" variant="outline" className="mt-3" onClick={onFix}>
                Kembali ke cart
              </Button>
            </div>
          ) : null}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Detail Pesanan
              </p>
              <span className="text-xs text-[var(--color-text-muted)]">
                {sale.lines.filter((line) => !line.removedAt).length} item
              </span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {sale.lines
                .filter((line) => !line.removedAt)
                .map((line) => (
                  <div key={line.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{line.itemNameSnapshot}</p>
                        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                          {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
                          {line.variantNameSnapshot ? ` · ${line.variantNameSnapshot}` : ''}
                        </p>
                        {line.itemTypeSnapshot === 'SERVICE' ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-[var(--color-text-muted)]">
                              {line.participations.filter((participation) => participation.assigned)
                                .length
                                ? line.participations
                                    .filter((participation) => participation.assigned)
                                    .map(
                                      (participation) =>
                                        `${name(participation.employeeId)}${participation.shareRate ? ` ${createDecimal(participation.shareRate).times(100).toFixed(0)}%` : ''}`,
                                    )
                                    .join(', ')
                                : 'Karyawan belum dipilih'}
                            </span>
                            {line.employeeAssignmentModeSnapshot === 'REQUIRED' ? (
                              <button
                                type="button"
                                onClick={() => onAssign(line)}
                                className={`rounded-md px-2 py-1 font-semibold transition-colors ${line.participations.some((participation) => participation.assigned) ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/15' : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/15'}`}
                              >
                                {line.participations.some((participation) => participation.assigned)
                                  ? 'Ubah karyawan'
                                  : 'Pilih karyawan'}
                              </button>
                            ) : null}
                            {line.fulfillmentBehaviorSnapshot === 'TRACKED' ? (
                              <>
                                <span className="rounded-md bg-[var(--color-surface-muted)] px-2 py-1 font-semibold text-[var(--color-text-muted)]">
                                  {line.fulfillment?.status === 'COMPLETED'
                                    ? 'Pekerjaan selesai'
                                    : line.fulfillment?.status === 'IN_PROGRESS'
                                      ? 'Sedang dikerjakan'
                                      : 'Menunggu dikerjakan'}
                                </span>
                                {line.fulfillment?.status !== 'COMPLETED' ? (
                                  <button
                                    type="button"
                                    disabled={!active}
                                    onClick={() =>
                                      onFulfillment(
                                        line,
                                        line.fulfillment?.status === 'IN_PROGRESS'
                                          ? 'COMPLETED'
                                          : 'IN_PROGRESS',
                                      )
                                    }
                                    className="rounded-md bg-[var(--color-brand)]/10 px-2 py-1 font-semibold text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand)]/15 disabled:opacity-50"
                                  >
                                    {line.fulfillment?.status === 'IN_PROGRESS'
                                      ? 'Tandai selesai'
                                      : 'Mulai pekerjaan'}
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-sm font-bold">
                        {money(line.totalAmount, locale)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ReferenceInfoTile
              icon={<User className="size-4" />}
              label="Pelanggan"
              value={saleCustomer(sale.id).name}
              sub={saleCustomer(sale.id).phone || undefined}
            />
            <ReferenceInfoTile
              icon={<CreditCard className="size-4" />}
              label="Pembayaran"
              value={money(paid.toFixed(4), locale)}
              sub={`Outstanding ${money(outstanding.toFixed(4), locale)}`}
            />
          </div>
          <div className="rounded-2xl bg-slate-950 p-4 text-white">
            <div className="flex justify-between text-sm text-slate-300">
              <span>Subtotal</span>
              <span>{money(sale.grossAmount, locale)}</span>
            </div>
            <div className="mt-2 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{money(sale.totalAmount, locale)}</span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function ReferenceCancelDialog({
  sale,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  sale: Sale | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={Boolean(sale)}
      onClose={onClose}
      ariaLabel="Cancel transaction"
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-md rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-danger)]">
              Batalkan Transaksi
            </p>
            <h2 className="mt-1 text-lg font-semibold">Batalkan transaksi ini?</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {sale ? transactionNumber(sale.id) : ''} tetap tercatat di antrian hari ini.
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Alasan ini hanya mengonfirmasi tindakan; kontrak void saat ini tidak menerima alasan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        <label className="mt-5 block text-sm font-medium">
          Alasan pembatalan
          <Input
            className="mt-1.5 h-10 rounded-lg"
            autoFocus
            value={reason}
            onChange={onReasonChange}
            placeholder="Contoh: Permintaan pelanggan"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Kembali
          </Button>
          <Button variant="danger" disabled={!reason.trim()} onClick={onConfirm}>
            Ya, Batalkan
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ReferenceEmployeeDialog({
  line,
  employees,
  locale,
  onClose,
  onSave,
}: {
  line: SaleLine | null;
  employees: readonly Employee[];
  locale: string;
  onClose: () => void;
  onSave: (
    employeeIds: string[],
    contributors: Array<{ employeeId: string; shareRate: string }>,
  ) => void;
}) {
  const initialRows =
    line?.participations
      .filter((participation) => participation.assigned)
      .map((participation) => ({
        employeeId: participation.employeeId,
        shareRate: participation.shareRate
          ? createDecimal(participation.shareRate).times(100).toFixed(0)
          : '100',
        locked: true,
      })) ?? [];
  const [rows, setRows] = useState<
    Array<{ employeeId: string; shareRate: string; locked: boolean }>
  >([]);
  const isOpen = Boolean(line);
  const activeRows = rows.length
    ? rows
    : initialRows.length
      ? initialRows
      : [{ employeeId: '', shareRate: '100', locked: false }];
  const distribute = (
    source: Array<{ employeeId: string; shareRate: string; locked: boolean }>,
  ) => {
    const locked = source
      .filter((row) => row.locked)
      .reduce((sum, row) => sum.plus(createDecimal(row.shareRate || '0')), createDecimal('0'));
    const openRows = source.filter((row) => !row.locked);
    if (!openRows.length) return source;
    const remaining = createDecimal('100').minus(locked).greaterThan(createDecimal('0'))
      ? createDecimal('100').minus(locked)
      : createDecimal('0');
    const base = remaining.dividedBy(openRows.length).toFixed(0);
    let placed = createDecimal('0');
    return source.map((row) => {
      if (row.locked) return row;
      placed = placed.plus(createDecimal(base));
      const isLast = openRows.indexOf(row) === openRows.length - 1;
      return {
        ...row,
        shareRate: isLast ? remaining.minus(placed.minus(createDecimal(base))).toFixed(0) : base,
      };
    });
  };
  const total = activeRows.reduce(
    (sum, row) => sum.plus(createDecimal(row.shareRate || '0')),
    createDecimal('0'),
  );
  const valid =
    activeRows.length > 0 &&
    activeRows.every((row) => row.employeeId) &&
    total.equals(createDecimal('100'));
  if (!line) return null;
  return (
    <Dialog
      open={isOpen}
      title="Karyawan untuk layanan"
      description="Lengkapi attribution layanan sebelum transaksi diselesaikan. Sistem membagi 100% secara rata."
      onClose={() => {
        setRows([]);
        onClose();
      }}
      ariaLabel="Assign service employees"
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-2xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <footer className="flex shrink-0 items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {valid ? 'Semua porsi valid (100%)' : 'Lengkapi karyawan untuk jasa ini'}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setRows([]);
                onClose();
              }}
            >
              Batal
            </Button>
            <Button
              disabled={!valid}
              onClick={() =>
                onSave(
                  activeRows.map((row) => row.employeeId),
                  activeRows.map((row) => ({
                    employeeId: row.employeeId,
                    shareRate: createDecimal(row.shareRate).dividedBy(100).toFixed(4),
                  })),
                )
              }
            >
              Simpan
            </Button>
          </div>
        </footer>
      }
    >
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{line.itemNameSnapshot}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Qty {quantity(line.quantity)} · {money(line.totalAmount, locale)}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${valid ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'}`}
          >
            Total {total.toFixed(0)}%
          </span>
        </div>
        <div className="space-y-2">
          {activeRows.map((row, index) => (
            <div key={`${row.employeeId}-${index}`} className="grid grid-cols-12 items-end gap-2">
              <label className="col-span-6 text-xs font-medium">
                Karyawan
                <div className="mt-1">
                  <Combobox
                    ariaLabel={`Employee ${index + 1}`}
                    value={row.employeeId}
                    placeholder="Pilih karyawan"
                    options={employees.map((employee) => ({
                      value: employee.id,
                      label: employee.displayName,
                    }))}
                    onChange={(employeeId) => {
                      if (typeof employeeId !== 'string') return;
                      const next = [...activeRows];
                      next[index] = { ...next[index]!, employeeId };
                      setRows(next);
                    }}
                  />
                </div>
              </label>
              <label className="col-span-3 text-xs font-medium">
                Porsi
                <div className="mt-1">
                  <PosNumericInput
                    aria-label={`Contribution ${index + 1}`}
                    className="h-9 rounded-lg text-sm"
                    disabled={activeRows.length === 1}
                    value={row.shareRate}
                    integer
                    min="0"
                    max="100"
                    suffix="%"
                    onChange={(shareRate) => {
                      const next = [...activeRows];
                      next[index] = {
                        ...next[index]!,
                        shareRate,
                        locked: true,
                      };
                      setRows(distribute(next));
                    }}
                  />
                </div>
              </label>
              <div className="col-span-3 flex h-9 items-center justify-end gap-1">
                <button
                  type="button"
                  title="Auto distribute"
                  disabled={activeRows.length === 1}
                  onClick={() => {
                    const next = [...activeRows];
                    next[index] = { ...next[index]!, locked: !next[index]!.locked };
                    setRows(distribute(next));
                  }}
                  className={`rounded-lg p-2 transition-colors ${row.locked ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'}`}
                >
                  %
                </button>
                <button
                  type="button"
                  disabled={activeRows.length === 1}
                  onClick={() =>
                    setRows(
                      distribute(
                        activeRows.filter((row, rowIndex) => Boolean(row) && rowIndex !== index),
                      ),
                    )
                  }
                  className="rounded-lg p-2 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setRows(distribute([...activeRows, { employeeId: '', shareRate: '0', locked: false }]))
          }
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-brand)] hover:underline"
        >
          <UserPlus className="size-3" />
          Tambah karyawan
        </button>
        {!valid ? (
          <p className="mt-2 text-xs text-[var(--color-warning)]">
            Lengkapi karyawan dan pastikan total porsi tepat 100%.
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function editableWorkContributors(
  contributors: readonly ServiceWorkContributor[],
): ServiceWorkContributor[] {
  return contributors.length
    ? contributors.map((contributor) => ({ ...contributor }))
    : [{ employeeId: '', shareRate: '1.0000' }];
}

function ServiceWorkContributorEditor({
  contributors,
  employees,
  onChange,
}: {
  contributors: readonly ServiceWorkContributor[];
  employees: readonly Employee[];
  onChange: (contributors: ServiceWorkContributor[]) => void;
}) {
  const rows = editableWorkContributors(contributors);
  const total = contributionTotal(rows).times(100).toFixed(0);

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div
          key={`${row.employeeId}-${index}`}
          className="grid grid-cols-[minmax(0,1fr)_74px_28px] items-end gap-2"
        >
          <label className="text-[11px] font-medium text-[var(--color-text-muted)]">
            Karyawan
            <Combobox
              ariaLabel={`Karyawan pengerjaan ${index + 1}`}
              value={row.employeeId}
              placeholder="Pilih karyawan"
              options={employees.map((employee) => ({
                value: employee.id,
                label: employee.displayName,
              }))}
              onChange={(employeeId) => {
                if (typeof employeeId !== 'string') return;
                const next = [...rows];
                next[index] = { ...next[index]!, employeeId };
                onChange(next);
              }}
            />
          </label>
          <label className="text-[11px] font-medium text-[var(--color-text-muted)]">
            Porsi
            <PosNumericInput
              aria-label={`Porsi pengerjaan ${index + 1}`}
              className="h-9 rounded-lg text-sm"
              value={createDecimal(row.shareRate).times(100).toFixed(0)}
              integer
              min="0"
              max="100"
              suffix="%"
              onChange={(shareRate) => {
                const next = [...rows];
                next[index] = {
                  ...next[index]!,
                  shareRate: createDecimal(shareRate || '0')
                    .dividedBy(100)
                    .toFixed(4),
                };
                onChange(next);
              }}
            />
          </label>
          <button
            type="button"
            disabled={rows.length === 1}
            aria-label={`Hapus karyawan ${index + 1}`}
            onClick={() => onChange([...rows.slice(0, index), ...rows.slice(index + 1)])}
            className="mb-0.5 rounded-lg p-2 text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10 disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange([...rows, { employeeId: '', shareRate: '0.0000' }])}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-brand)] hover:underline"
        >
          <UserPlus className="size-3" />
          Tambah karyawan
        </button>
        <span
          className={`text-xs font-semibold ${total === '100' ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}
        >
          Total {total}%
        </span>
      </div>
    </div>
  );
}

function ReferenceServiceWorkDialog({
  line,
  employees,
  locale,
  units,
  onClose,
  onSave,
}: {
  line: SaleLine | null;
  employees: readonly Employee[];
  locale: string;
  units: readonly ServiceWorkUnit[];
  onClose: () => void;
  onSave: (units: readonly ServiceWorkUnit[]) => void;
}) {
  const [mode, setMode] = useState<'SAME' | 'PER_UNIT'>('SAME');
  const [sharedContributors, setSharedContributors] = useState<ServiceWorkContributor[]>(() =>
    editableWorkContributors(units[0]?.contributors ?? []),
  );
  const [unitPlans, setUnitPlans] = useState<ServiceWorkUnit[]>(() =>
    units.map((unit) => ({
      ...unit,
      contributors: editableWorkContributors(unit.contributors),
    })),
  );

  if (!line) return null;
  const plannedUnits =
    mode === 'SAME'
      ? units.map((unit) => ({ ...unit, contributors: sharedContributors }))
      : unitPlans;
  const valid = plannedUnits.every((unit) => hasValidWorkAssignment(line, unit));

  return (
    <Dialog
      open
      title="Kelola pengerjaan"
      description={`${line.itemNameSnapshot} · ${quantity(line.quantity)} pengerjaan layanan`}
      onClose={onClose}
      ariaLabel="Kelola pengerjaan layanan"
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-2xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {valid ? 'Setiap pengerjaan valid (100%)' : 'Setiap pengerjaan harus tepat 100%'}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Batal
            </Button>
            <Button disabled={!valid} onClick={() => onSave(plannedUnits)}>
              Simpan pengerjaan
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/20 p-3">
          <p className="text-sm font-semibold">{line.itemNameSnapshot}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
          </p>
        </div>
        <div className="flex gap-2" aria-label="Mode pengerjaan">
          <DButton
            size="sm"
            variant={mode === 'SAME' ? 'primary' : 'secondary'}
            onClick={() => setMode('SAME')}
          >
            Sama untuk semua
          </DButton>
          <DButton
            size="sm"
            variant={mode === 'PER_UNIT' ? 'primary' : 'secondary'}
            onClick={() => setMode('PER_UNIT')}
          >
            Atur per pengerjaan
          </DButton>
        </div>
        {mode === 'SAME' ? (
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">
              Konfigurasi ini diterapkan ke semua {units.length} pengerjaan.
            </p>
            <ServiceWorkContributorEditor
              contributors={sharedContributors}
              employees={employees}
              onChange={setSharedContributors}
            />
          </div>
        ) : (
          <div className="max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
            {unitPlans.map((unit) => (
              <div key={unit.index} className="rounded-xl border border-[var(--color-border)] p-3">
                <div className="mb-3">
                  <p className="text-sm font-semibold">Pengerjaan #{unit.index + 1}</p>
                </div>
                <ServiceWorkContributorEditor
                  contributors={unit.contributors}
                  employees={employees}
                  onChange={(contributors) =>
                    setUnitPlans((current) =>
                      current.map((candidate) =>
                        candidate.index === unit.index ? { ...candidate, contributors } : candidate,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
