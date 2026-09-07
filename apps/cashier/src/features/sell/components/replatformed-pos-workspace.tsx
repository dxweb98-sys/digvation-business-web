import { useAuth } from '@digvation/pos-auth';
import { createDecimal, formatMoney } from '@digvation/pos-money';
import { useRuntime } from '@digvation/pos-runtime';
import {
  DBadge as Badge,
  DButton,
  DButton as Button,
  DCombobox,
  DCombobox as Combobox,
  DDialog,
  DDialog as Dialog,
  DDropdown as Dropdown,
  DInput,
  DInput as Input,
  DSearchInput as SearchInput,
  DSkeleton as Skeleton,
} from '@digvation/ui';
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

import { cashierTransactionKeys } from '../cashier-transaction-keys';
import { createCashierTransactionAdapter } from '../cashier-transaction-client';
import {
  customerMemberLookup,
  type MemberCustomerLookupResult,
  type TransactionCustomer,
} from '../customer-member-lookup';
import type {
  CatalogItem,
  Employee,
  PaymentMethod,
  Sale,
  SaleLine,
} from '../cashier-transaction.types';
import type { CatalogItemTypeFilter } from '../use-selling-catalog';
import type { useCashierTransactionWorkspace } from '../use-cashier-transaction-workspace';

import { PosCurrencyInput, PosNumericInput } from './pos-controls';
import { SaleLineTaskDialog } from './sale-line-task-dialog';
import './replatformed-pos-workspace.css';

type Workspace = ReturnType<typeof useCashierTransactionWorkspace>;
type QueueStatus = 'DRAFT' | 'PROGRESS' | 'COMPLETED' | 'CANCELED';

type PosCustomer = TransactionCustomer;

const CURRENT_CUSTOMER_KEY = 'digvation-pos-demo-current-customer';
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

const statusMeta: Record<
  QueueStatus,
  { label: string; icon: ReactNode; tone: string; soft: string }
> = {
  DRAFT: {
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

function queueStatus(sale: Sale): QueueStatus {
  if (sale.status === 'FINALIZED') return 'COMPLETED';
  if (sale.status === 'VOIDED') return 'CANCELED';
  if (sale.lines.some((line) => line.fulfillment?.status === 'IN_PROGRESS')) return 'PROGRESS';
  return 'DRAFT';
}

function isPositiveDecimal(value: string) {
  try {
    return createDecimal(value).greaterThan(createDecimal('0'));
  } catch {
    return false;
  }
}

function workflowIssues(sale: Sale, requiresEmployeeAttribution = true) {
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
    if (
      line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
      line.fulfillment?.status !== 'COMPLETED'
    ) {
      issues.push(`${line.itemNameSnapshot}: pekerjaan belum selesai.`);
    }
    if (
      requiresEmployeeAttribution &&
      line.employeeAssignmentModeSnapshot === 'REQUIRED' &&
      !line.participations.some((p) => p.assigned)
    ) {
      issues.push(`${line.itemNameSnapshot}: pilih karyawan.`);
    }
    if (requiresEmployeeAttribution && line.allowEmployeeContributionSnapshot) {
      const shares = line.participations.filter((p) => p.assigned && p.shareRate !== null);
      const total = shares.reduce(
        (sum, p) => sum.plus(createDecimal(p.shareRate ?? '0')),
        createDecimal('0'),
      );
      if (!shares.length || !total.equals(createDecimal('1'))) {
        issues.push(`${line.itemNameSnapshot}: kontribusi karyawan harus tepat 100%.`);
      }
    }
  }
  return issues;
}

export function ReplatformedPosWorkspace({ workspace }: { workspace: Workspace }) {
  const runtime = useRuntime();
  const { session } = useAuth();
  const adapter = useMemo(
    () => createCashierTransactionAdapter(runtime.apiBaseUrl),
    [runtime.apiBaseUrl],
  );
  const transactionsQuery = useQuery({
    queryKey: cashierTransactionKeys.sales(),
    queryFn: ({ signal }) => adapter.listSales(signal),
    refetchInterval: 1_500,
  });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [queueTab, setQueueTab] = useState<QueueStatus>('DRAFT');
  const [queueIssues, setQueueIssues] = useState<Record<string, string[]>>({});
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueDetail, setQueueDetail] = useState<Sale | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCustomer, setCartCustomer] = useState<PosCustomer | null>(() =>
    readStoredCustomer(CURRENT_CUSTOMER_KEY),
  );
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [provider, setProvider] = useState('');
  const [tender, setTender] = useState('');
  const [reviewTarget, setReviewTarget] = useState<Sale | null>(null);
  const [assignmentLine, setAssignmentLine] = useState<SaleLine | null>(null);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);

  const sale = workspace.viewModel.sale;
  const lines = workspace.viewModel.activeLines;
  const total = sale?.totalAmount ?? '0.0000';

  useEffect(() => {
    writeStoredCustomer(CURRENT_CUSTOMER_KEY, cartCustomer);
    if (sale?.id) writeStoredCustomer(saleCustomerKey(sale.id), cartCustomer);
  }, [cartCustomer, sale?.id]);

  const displayedQueueDetail =
    receiptSaleId && sale?.id === receiptSaleId && sale.status === 'FINALIZED' ? sale : queueDetail;
  const categories = useMemo(
    () => [
      ...new Set(
        workspace.items
          .map((item) => item.categoryId)
          .filter((value): value is string => Boolean(value)),
      ),
    ],
    [workspace.items],
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
    const records = transactionsQuery.data?.items ?? [];
    return {
      DRAFT: records.filter((record) => queueStatus(record) === 'DRAFT'),
      PROGRESS: records.filter((record) => queueStatus(record) === 'PROGRESS'),
      COMPLETED: records.filter((record) => queueStatus(record) === 'COMPLETED'),
      CANCELED: records.filter((record) => queueStatus(record) === 'CANCELED'),
    };
  }, [transactionsQuery.data]);

  const selectType = (type: CatalogItemTypeFilter) => {
    workspace.setItemType(type);
    setSelectedCategory('');
  };
  const resume = (transaction: Sale) => {
    workspace.resumeSale(transaction.id);
    const customer = readStoredCustomer(saleCustomerKey(transaction.id));
    setCartCustomer(customer);
    writeStoredCustomer(CURRENT_CUSTOMER_KEY, customer);
    setQueueIssues((current) => ({ ...current, [transaction.id]: [] }));
    setCartOpen(true);
  };
  const requestReview = (transaction: Sale) => {
    workspace.resumeSale(transaction.id);
    setReviewTarget(transaction);
  };
  const complete = () => {
    const currentReview = sale?.id === reviewTarget?.id ? sale : reviewTarget;
    if (!currentReview || workflowIssues(currentReview).length) return;
    setReceiptSaleId(currentReview.id);
    setCartOpen(false);
    workspace.finalizeSale();
    setReviewTarget(null);
  };
  const confirmCancel = () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    if (sale?.id !== cancelTarget.id) {
      workspace.resumeSale(cancelTarget.id);
      return;
    }
    workspace.voidSale();
    setCancelTarget(null);
    setCancelReason('');
  };
  const pay = () => {
    if (!sale || !lines.length) return;
    const applied = paymentMethod === 'CASH' ? tender || total : total;
    if (!isPositiveDecimal(applied)) return;
    if (paymentMethod === 'CASH' && createDecimal(applied).lessThan(createDecimal(total))) return;
    if ((paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'WALLET') && !provider) return;
    workspace.createPayment(
      paymentMethod,
      total,
      paymentMethod === 'CASH' ? applied : undefined,
      provider || undefined,
    );
    setCheckoutOpen(false);
    setCartOpen(true);
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
        onResume={resume}
        onComplete={requestReview}
        onCancel={(transaction) => {
          setCancelTarget(transaction);
          setCancelReason('Permintaan pelanggan');
        }}
        onView={setQueueDetail}
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
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold transition-colors ${selectedCategory === category ? 'bg-[var(--color-brand)] text-white' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}
                  >
                    {category}
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
                  price={workspace.priceByItemId.get(item.id)?.amount ?? '0.0000'}
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
        gross={sale?.grossAmount ?? '0.0000'}
        locale={workspace.locale}
        customer={cartCustomer}
        employees={workspace.employees}
        onChooseCustomer={() => setCustomerPickerOpen(true)}
        onManageEmployee={setAssignmentLine}
        onQuantity={(line, next) => workspace.changeQuantity(line, next)}
        onRemove={workspace.removeLine}
        onManageLine={workspace.openLineTask}
        onCheckout={() => {
          setTender(total);
          setPaymentMethod('CASH');
          setProvider('');
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
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
        onClose={() => setCheckoutOpen(false)}
        lines={lines}
        total={total}
        gross={sale?.grossAmount ?? '0.0000'}
        locale={workspace.locale}
        customer={cartCustomer}
        method={paymentMethod}
        provider={provider}
        tender={tender}
        change={change}
        isCashShort={cashShort}
        onMethod={(next) => {
          setPaymentMethod(next);
          setProvider('');
        }}
        onProvider={setProvider}
        onTender={setTender}
        quickTender={quickTender}
        onSaveDraft={() => setCheckoutOpen(false)}
        onPay={pay}
      />
      <ReferenceTransactionDetail
        sale={displayedQueueDetail}
        locale={workspace.locale}
        employees={workspace.employees}
        businessName={runtime.branding.businessName ?? runtime.branding.productName}
        branchName="Main Branch"
        cashierName={session.identity.displayName}
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
      />
      <ReferenceReviewDialog
        sale={reviewTarget && sale?.id === reviewTarget.id ? sale : reviewTarget}
        activeSale={workspace.viewModel.sale}
        locale={workspace.locale}
        employees={workspace.employees}
        issues={
          reviewTarget ? workflowIssues(sale?.id === reviewTarget.id ? sale : reviewTarget) : []
        }
        onClose={() => setReviewTarget(null)}
        onFix={() => {
          if (reviewTarget) resume(reviewTarget);
          setReviewTarget(null);
        }}
        onAssign={setAssignmentLine}
        onFulfillment={(line, status) => workspace.transitionFulfillment(line, status)}
        onComplete={complete}
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
        onClose={() => setAssignmentLine(null)}
        onSave={(employeeIds, contributors) => {
          if (!assignmentLine) return;
          workspace.setAssignments(assignmentLine, employeeIds);
          if (assignmentLine.allowEmployeeContributionSnapshot)
            workspace.setContributions(assignmentLine, contributors);
          setAssignmentLine(null);
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
  price: string;
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
        <p className="text-sm font-bold text-[var(--color-brand)]">{money(price, locale)}</p>
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
  onResume,
  onComplete,
  onCancel,
  onView,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  active: QueueStatus;
  onChangeTab: (status: QueueStatus) => void;
  groups: Record<QueueStatus, Sale[]>;
  issues: Record<string, string[]>;
  locale: string;
  onResume: (sale: Sale) => void;
  onComplete: (sale: Sale) => void;
  onCancel: (sale: Sale) => void;
  onView: (sale: Sale) => void;
}) {
  const statuses = Object.keys(statusMeta) as QueueStatus[];
  const count = statuses.reduce((sum, status) => sum + groups[status].length, 0);
  const list = groups[active];
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
            <div className="space-y-3 border-t border-[var(--color-border)] p-3">
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
                        onResume={onResume}
                        onComplete={onComplete}
                        onCancel={onCancel}
                        onView={onView}
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
  onResume,
  onComplete,
  onCancel,
  onView,
}: {
  sale: Sale;
  status: QueueStatus;
  locale: string;
  issues: string[];
  onResume: (sale: Sale) => void;
  onComplete: (sale: Sale) => void;
  onCancel: (sale: Sale) => void;
  onView: (sale: Sale) => void;
}) {
  const meta = statusMeta[status];
  const paid = sale.payments.some((payment) => payment.status === 'SUCCEEDED');
  const customer = saleCustomer(sale.id);
  const actionItems = [
    { label: 'Detail', icon: <Eye className="size-3.5" />, onSelect: () => onView(sale) },
    ...(status === 'DRAFT'
      ? [
          {
            label: 'Lanjutkan',
            icon: <PlayCircle className="size-3.5" />,
            onSelect: () => onResume(sale),
          },
          {
            label: 'Review & Selesaikan',
            icon: <CheckCircle2 className="size-3.5" />,
            onSelect: () => onComplete(sale),
          },
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
          {
            label: 'Lanjutkan',
            icon: <PlayCircle className="size-3.5" />,
            onSelect: () => onResume(sale),
          },
          {
            label: 'Review & Selesaikan',
            icon: <CheckCircle2 className="size-3.5" />,
            onSelect: () => onComplete(sale),
          },
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
            {paid ? 'Lunas' : 'Belum Bayar'}
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
  locale,
  customer,
  employees,
  onChooseCustomer,
  onManageEmployee,
  onQuantity,
  onRemove,
  onManageLine,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  lines: readonly SaleLine[];
  total: string;
  gross: string;
  locale: string;
  customer: PosCustomer | null;
  employees: readonly Employee[];
  onChooseCustomer: () => void;
  onManageEmployee: (line: SaleLine) => void;
  onQuantity: (line: SaleLine, quantity: string) => void;
  onRemove: (line: SaleLine) => void;
  onManageLine: (line: SaleLine) => void;
  onCheckout: () => void;
}) {
  const panel = (
    <ReferenceCartPanel
      lines={lines}
      total={total}
      gross={gross}
      locale={locale}
      customer={customer}
      employees={employees}
      onChooseCustomer={onChooseCustomer}
      onManageEmployee={onManageEmployee}
      onQuantity={onQuantity}
      onRemove={onRemove}
      onManageLine={onManageLine}
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
  locale,
  customer,
  employees,
  onChooseCustomer,
  onManageEmployee,
  onQuantity,
  onRemove,
  onManageLine,
  onCheckout,
}: {
  lines: readonly SaleLine[];
  total: string;
  gross: string;
  locale: string;
  customer: PosCustomer | null;
  employees: readonly Employee[];
  onChooseCustomer: () => void;
  onManageEmployee: (line: SaleLine) => void;
  onQuantity: (line: SaleLine, quantity: string) => void;
  onRemove: (line: SaleLine) => void;
  onManageLine: (line: SaleLine) => void;
  onCheckout: () => void;
}) {
  const status = customerStatus(customer);
  const increment = (line: SaleLine, direction: 'up' | 'down') => {
    const next =
      direction === 'up'
        ? createDecimal(line.quantity).plus(createDecimal('1'))
        : createDecimal(line.quantity).minus(createDecimal('1'));
    if (next.lessThanOrEqualTo(createDecimal('0'))) onRemove(line);
    else onQuantity(line, next.toFixed(4));
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
                {line.itemTypeSnapshot === 'SERVICE' ? (
                  <button
                    type="button"
                    onClick={() => onManageEmployee(line)}
                    className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl bg-[var(--color-brand)]/5 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--color-brand)]/10"
                  >
                    <span className="min-w-0 truncate font-semibold text-[var(--color-brand)]">
                      {employeeSummary(line, employees)}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-[var(--color-text-muted)]">
                      Atur
                    </span>
                  </button>
                ) : null}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="inline-grid grid-cols-[36px_48px_36px] items-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] shadow-[inset_0_1px_0_rgb(15_23_42_/_0.02)]">
                    <button
                      type="button"
                      aria-label={`Decrease ${line.itemNameSnapshot} quantity`}
                      onClick={() => increment(line, 'down')}
                      className="flex h-9 items-center justify-center border-r border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] active:bg-[var(--color-surface-muted)]"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <PosNumericInput
                      aria-label={`Quantity for ${line.itemNameSnapshot}`}
                      value={quantity(line.quantity)}
                      min="1"
                      onChange={(value) => {
                        if (value) onQuantity(line, value);
                      }}
                      className="h-9 w-12 rounded-none border-0 bg-transparent px-0 text-center text-xs font-bold tabular-nums focus:ring-0"
                    />
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
                {line.itemTypeSnapshot === 'SERVICE' ? (
                  <button
                    type="button"
                    onClick={() => onManageLine(line)}
                    className="mt-2 text-xs font-semibold text-[var(--color-brand)] hover:underline"
                  >
                    Kelola layanan
                  </button>
                ) : null}
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
            <span className="text-[var(--color-text-muted)]">Subtotal</span>
            <span className="font-medium">{money(gross, locale)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
            <span className="text-sm font-bold">Total</span>
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
              Perubahan cart tersimpan pada transaksi aktif.
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
  locale,
  customer,
  method,
  provider,
  tender,
  change,
  isCashShort,
  onMethod,
  onProvider,
  onTender,
  quickTender,
  onSaveDraft,
  onPay,
}: {
  open: boolean;
  onClose: () => void;
  lines: readonly SaleLine[];
  total: string;
  gross: string;
  locale: string;
  customer: PosCustomer | null;
  method: PaymentMethod;
  provider: string;
  tender: string;
  change: string;
  isCashShort: boolean;
  onMethod: (method: PaymentMethod) => void;
  onProvider: (provider: string) => void;
  onTender: (amount: string) => void;
  quickTender: readonly string[];
  onSaveDraft: () => void;
  onPay: () => void;
}) {
  const isCash = method === 'CASH';
  const needsProvider = method === 'BANK_TRANSFER' || method === 'WALLET';
  const canPay = lines.length > 0 && !isCashShort && (!needsProvider || Boolean(provider));
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
      description="Review pesanan sebelum simpan draft atau bayar langsung."
      open={open}
      onClose={onClose}
      ariaLabel="Checkout payment"
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-lg overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
    >
      <div className="flex max-h-[85dvh] min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Checkout Pembayaran</h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
              Review pesanan sebelum simpan draft atau bayar langsung.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
          >
            <X className="size-[18px]" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
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
                <p className="text-[11px] text-[var(--color-text-muted)]">{lines.length} item</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-[var(--color-surface-muted)]/60 px-3 py-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Subtotal</span>
                <span className="font-semibold">{money(gross, locale)}</span>
              </div>
            </div>
          </div>
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
                          <span className="ml-1 font-semibold text-[var(--color-brand)]">
                            · Jasa
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold">{money(line.totalAmount, locale)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
        </div>
        <footer className="flex shrink-0 flex-col-reverse justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 px-6 py-3 sm:flex-row">
          <DButton variant="ghost" onClick={onClose}>
            Batal
          </DButton>
          <DButton variant="outline" disabled={!lines.length} onClick={onSaveDraft}>
            Simpan Draft
          </DButton>
          <DButton
            disabled={!canPay}
            onClick={onPay}
            leftIcon={<CheckCircle2 className="size-3.5" />}
          >
            {method === 'QRIS' ? 'Bayar QRIS' : 'Bayar Langsung'}
          </DButton>
        </footer>
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
  onClose,
  onNewSale,
}: {
  sale: Sale | null;
  locale: string;
  employees: readonly Employee[];
  businessName: string;
  branchName: string;
  cashierName: string;
  onClose: () => void;
  onNewSale: () => void;
}) {
  if (!sale) return null;
  const status =
    sale.status === 'FINALIZED' ? 'COMPLETED' : sale.status === 'VOIDED' ? 'CANCELED' : 'DRAFT';
  const customer = saleCustomer(sale.id);
  const activeLines = sale.lines.filter((line) => !line.removedAt);
  const payment = sale.payments.find((candidate) => candidate.status === 'SUCCEEDED') ?? null;
  const finalized = sale.status === 'FINALIZED';
  const transactionDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(sale.finalizedAt ?? sale.updatedAt));

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={finalized ? 'Receipt preview' : 'Transaction detail'}
      closeOnEscape
      closeOnOverlay
      className={`pos-reference-dialog w-full overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl ${finalized ? 'max-w-md' : 'max-w-lg'}`}
    >
      {finalized ? (
        <div className="flex max-h-[92dvh] min-h-0 flex-col">
          <div className="pos-receipt-print min-h-0 flex-1 overflow-y-auto bg-white px-6 py-6 text-slate-950">
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

            <section className="space-y-4">
              {activeLines.map((line) => (
                <div key={line.id} className="text-xs">
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
                  {line.itemTypeSnapshot === 'SERVICE' &&
                  line.participations.some((participation) => participation.assigned) ? (
                    <p className="mt-1 leading-5 text-slate-600">
                      {employeeSummary(line, employees)}
                    </p>
                  ) : null}
                </div>
              ))}
            </section>

            <div className="my-4 border-t border-dashed border-slate-300" />

            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Subtotal</dt>
                <dd>{money(sale.grossAmount, locale)}</dd>
              </div>
              {sale.discountAmount !== '0.0000' ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Diskon</dt>
                  <dd>−{money(sale.discountAmount, locale)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Pajak</dt>
                <dd>{money(sale.taxAmount, locale)}</dd>
              </div>
              <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 text-sm font-black">
                <dt>TOTAL</dt>
                <dd>{money(sale.totalAmount, locale)}</dd>
              </div>
            </dl>

            <div className="my-4 border-t border-dashed border-slate-300" />

            <section className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Pembayaran</span>
                <span className="font-semibold">{payment?.method.replace('_', ' ') ?? '-'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Dibayar</span>
                <span>{payment ? money(payment.appliedAmount, locale) : '-'}</span>
              </div>
              {payment?.method === 'CASH' ? (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Uang diterima</span>
                    <span>{money(payment.tenderedAmount ?? payment.appliedAmount, locale)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Kembalian</span>
                    <span>{money(payment.changeAmount ?? '0.0000', locale)}</span>
                  </div>
                </>
              ) : null}
            </section>

            <div className="my-4 border-t border-dashed border-slate-300" />
            <p className="text-center text-xs font-bold">LUNAS · FINALIZED</p>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Terima kasih telah bertransaksi.
            </p>
          </div>

          <footer className="pos-receipt-actions flex shrink-0 gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Tutup
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => window.print()}>
              <Printer className="mr-2 size-4" /> Cetak
            </Button>
            <Button className="flex-1" onClick={onNewSale}>
              Transaksi Baru
            </Button>
          </footer>
        </div>
      ) : (
        <div className="flex max-h-[85dvh] min-h-0 flex-col">
          <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">Detail Transaksi POS</h2>
              <p className="mt-0.5 font-mono text-sm text-[var(--color-text-muted)]">
                {transactionNumber(sale.id)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
            >
              <X className="size-[18px]" />
            </button>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--color-surface-muted)]/30 px-4 py-4">
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
              <div className="bg-gradient-to-br from-[var(--color-brand)]/5 to-transparent px-5 py-4">
                <p className="font-mono text-xs text-[var(--color-text-muted)]">
                  {transactionNumber(sale.id)}
                </p>
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">Total Transaksi</p>
                <h3 className="mt-0.5 text-3xl font-bold tracking-tight">
                  {money(sale.totalAmount, locale)}
                </h3>
                <span
                  className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta[status].tone}`}
                >
                  {statusMeta[status].label}
                </span>
              </div>
            </div>
            <ReferenceInfoTile
              icon={<User className="size-4" />}
              label="Pelanggan"
              value={customer.name}
              sub={customer.phone || undefined}
            />
            <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
              {activeLines.map((line) => (
                <div key={line.id} className="p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{line.itemNameSnapshot}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
                        {line.variantNameSnapshot ? ` · ${line.variantNameSnapshot}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-bold">{money(line.totalAmount, locale)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <footer className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 px-6 py-3 text-right">
            <Button variant="outline" onClick={onClose}>
              Tutup
            </Button>
          </footer>
        </div>
      )}
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
      onClose={onClose}
      ariaLabel="Review and complete transaction"
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-2xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
    >
      <div className="flex max-h-[85dvh] min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Review &amp; Selesaikan</h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
              {transactionNumber(sale.id)} · {saleCustomer(sale.id).name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
          >
            <X className="size-[18px]" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
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
        <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 px-6 py-3">
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
      onClose={() => {
        setRows([]);
        onClose();
      }}
      ariaLabel="Assign service employees"
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-2xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
    >
      <div className="flex max-h-[85dvh] min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Karyawan untuk layanan</h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
              Lengkapi attribution layanan sebelum transaksi diselesaikan. Sistem membagi 100%
              secara rata.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRows([]);
              onClose();
            }}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
          >
            <X className="size-[18px]" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
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
                <div
                  key={`${row.employeeId}-${index}`}
                  className="grid grid-cols-12 items-end gap-2"
                >
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
                            activeRows.filter(
                              (row, rowIndex) => Boolean(row) && rowIndex !== index,
                            ),
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
                setRows(
                  distribute([...activeRows, { employeeId: '', shareRate: '0', locked: false }]),
                )
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
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 px-6 py-3">
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
      </div>
    </Dialog>
  );
}
