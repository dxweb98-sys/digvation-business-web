import { useAuth } from '@digvation/pos-auth';
import { createDecimal } from '@digvation/pos-money';
import { useRuntime } from '@digvation/pos-runtime';
import {
  DButton as Button,
  DConfirmDialog,
  DSearchInput as SearchInput,
  DSkeleton as Skeleton,
  useToast,
} from '@digvation-labs/ui';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, RotateCcw, ShoppingBag, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  QUEUE_REFRESH_INTERVAL_MS,
  liveQueryPolicy,
} from '../../../../app/data/operational-cache-policy';
import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { cashierTransactionKeys } from '../../transaction/api/cashier-transaction-keys';
import { cashierTransactionErrorMessage } from '../../transaction/api/cashier-transaction-errors';
import {
  createCashierTransactionAdapter,
  isLocalCashierDemoEnabled,
} from '../../transaction/api/cashier-transaction-adapter-factory';
import {
  paymentProgress,
  saleTaxLabel,
  transactionDiscountLabel,
} from '../../transaction/model/sale-presentation';
import type { Payment, Sale } from '../../transaction/model/cashier-transaction.types';
import type { useCashierTransactionWorkspace } from '../model/use-cashier-transaction-workspace';

import { currencyInputFromAmount, normalizeCurrencyPaymentInput } from '../../lib/pos-controls';
import { SaleAdjustmentControls } from '../../adjustment/sale-adjustment-controls';
import { SaleLineTaskDialog } from '../../queue/sale-line-task-dialog';
import { ServicePerformersDialog } from '../../performer/service-performers-dialog';
import {
  presentableTransaction,
  useCanReadCompletedSaleDetails,
} from '../../transaction/model/completed-sale-visibility';
import { CustomerMemberDialog } from '../../customer/ui/customer-member-dialog';
import { WalkInCustomerEditDialog } from '../../customer/ui/walk-in-customer-edit-dialog';
import { ReceiptDeliveryDialog } from '../../receipt/receipt-delivery-dialog';
import { canAdjustOrder } from '../../adjustment/sale-adjustment-access';
import { completeSettledCheckout, hasTrackedWork } from '../../transaction/model/sale-lifecycle';
import { type QueueStatus } from '../../queue/queue-status';
import {
  type QueuedSaleEntry,
  readQueuedSaleEntries,
  writeQueuedSaleEntries,
} from '../../queue/queued-sale-storage';
import {
  hasSuccessfulCheckout,
  financialSummary,
  type TerminalPaymentStatus,
  hasSuccessfulPayment,
} from '../../payment/sale-payment-status';
import { processIssues } from '../../queue/workflow-issues';
import { money, transactionNumber, isPositiveDecimal } from '../../transaction/model/sale-display';
import { ReferenceQueueBoard } from '../../queue/reference-queue-board';
import { ReferenceTypeButton } from '../../catalog/reference-type-button';
import { ReferenceCatalogCard } from '../../catalog/reference-catalog-card';
import { ReferenceFloatingCart } from '../../cart/reference-floating-cart';
import { ReferencePaymentDialog } from '../../payment/reference-payment-dialog';
import { ReferenceTransactionDetail } from '../../transaction/ui/reference-transaction-detail';
import { ReferenceOrderAdjustmentDialog } from '../../adjustment/reference-order-adjustment-dialog';
import { ReferenceBalancePaymentDialog } from '../../payment/reference-balance-payment-dialog';
import { ReferenceCancelDialog } from '../../transaction/ui/reference-cancel-dialog';
import { useSaleCustomerContext } from '../../customer/model/use-sale-customer-context';
import { useSellingCatalogFilter } from '../../catalog/use-selling-catalog-filter';
import { useDraftTaxPreview } from '../../cart/use-draft-tax-preview';
import { useCartPricingPreview } from '../../cart/use-cart-pricing-preview';
import { useQueueGroups } from '../../queue/use-queue-groups';
import { useCheckoutPaymentForm } from '../../payment/use-checkout-payment-form';
import { useReceiptDeliveryPreview } from '../../receipt/use-receipt-delivery-preview';
import { useServicePerformerAssignment } from '../../performer/use-service-performer-assignment';
import { useQueuedWorkActions } from '../../queue/use-queued-work-actions';
import { useOrderAdjustment } from '../../adjustment/use-order-adjustment';
import { useQueuedSaleCancellation } from '../../queue/use-queued-sale-cancellation';
import { useQueuedSaleCustomerEdit } from '../../queue/use-queued-sale-customer-edit';
import { useQueuedSaleCompletion } from '../../queue/use-queued-sale-completion';
import './replatformed-pos-workspace.css';

type Workspace = ReturnType<typeof useCashierTransactionWorkspace>;

type FulfillmentDestination = 'QUEUE' | 'START_PROCESS';

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

  const {
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    categories,
    visibleItems,
    selectType,
  } = useSellingCatalogFilter({ workspace });

  const [queueTab, setQueueTab] = useState<QueueStatus>('QUEUED');
  const [queuedSaleEntries, setQueuedSaleEntries] = useState<QueuedSaleEntry[]>(() =>
    isLocalDemo ? readQueuedSaleEntries() : [],
  );
  const [queueIssues] = useState<Record<string, string[]>>({});
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueDetail, setQueueDetail] = useState<Sale | null>(null);

  const [queuePaymentTarget, setQueuePaymentTarget] = useState<Sale | null>(null);
  const [queuePaymentAmount, setQueuePaymentAmount] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  const { performerTarget, setPerformerTarget, isSavingPerformers, savePerformers } =
    useServicePerformerAssignment({ workspace, setQueueDetail, showToast, copy });

  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const {
    cancelTarget,
    setCancelTarget,
    cancelReason,
    setCancelReason,
    cancellationReasons,
    requestCancel,
    confirmCancel,
  } = useQueuedSaleCancellation({
    workspace,
    isLocalDemo,
    setQueueDetail,
    setQueueTab,
    setReceiptSaleId,
    showToast,
    copy,
  });

  // Effective permission, never a role name: without it completed transactions
  // show no amount, detail or receipt, and can only be sent to the customer.
  const canReadCompleted = useCanReadCompletedSaleDetails();
  const {
    completionConfirmationTarget,
    setCompletionConfirmationTarget,
    completeQueuedTransaction,
    confirmQueuedCompletion,
  } = useQueuedSaleCompletion({
    workspace,
    canReadCompleted,
    setQueueTab,
    setQueueDetail,
    setReceiptSaleId,
    showToast,
    copy,
  });

  const sale = workspace.viewModel.sale;
  const lines = workspace.cart.lines;
  const total = workspace.cart.totalAmount;
  const {
    draftTaxAmount,
    cartPreviewTotal,
    isTaxPreviewLoading,
    isTaxPreviewUnavailable,
    draftTaxLabel,
  } = useDraftTaxPreview({ adapter, sale, workspace, total, copy });
  // Runtime prices the draft read-only; until its first answer, or if it fails, the cart keeps the
  // plain estimate above. A Sale always shows its own amounts.
  const pricingPreview = useCartPricingPreview({
    adapter,
    input: workspace.cart.pricingInput,
    copy,
  });

  const activeCustomer = workspace.customer;
  const {
    selectedMember,
    setSelectedMember,
    customerPickerSession,
    startNewCustomerTransaction,
    customerCacheScope,
    customerMemberApi,
    canReadMembers,
    canEnrollMember,
    canReadCustomers,
    canRedeemLoyalty,
    canReadLoyalty,
    activeSelectedMember,
    cartCustomer,
    memberIdentityQuery,
    memberBalanceQuery,
  } = useSaleCustomerContext({ activeCustomer, sale, session, runtime, authPort });
  const {
    checkoutOpen,
    setCheckoutOpen,
    payNow,
    setPayNow,
    paymentMethod,
    setPaymentMethod,
    paymentRouteId,
    setPaymentRouteId,
    paymentAmount,
    setPaymentAmount,
    loyaltyPoints,
    setLoyaltyPoints,
    paymentReference,
    setPaymentReference,
    tender,
    setTender,
    paymentError,
    setPaymentError,
    isRecordingPayment,
    sendPaymentOnce,
  } = useCheckoutPaymentForm({ activeCustomer });

  const displayedQueueDetail =
    receiptSaleId && sale?.id === receiptSaleId && hasSuccessfulPayment(sale) ? sale : queueDetail;
  const {
    receiptDeliveryTarget,
    setReceiptDeliveryTarget,
    receiptLocation,
    receiptDeliveryStatusQuery,
    openReceiptDelivery,
  } = useReceiptDeliveryPreview({ adapter, displayedQueueDetail, workspace });

  const displayedQueuePaymentTarget =
    queuePaymentTarget && sale?.id === queuePaymentTarget.id ? sale : queuePaymentTarget;
  const { setAdjustmentTarget, displayedAdjustmentTarget, openAdjustment } = useOrderAdjustment({
    workspace,
    session,
    sale,
    setQueueDetail,
    showToast,
    copy,
  });

  const { groups } = useQueueGroups({
    transactionsQuery,
    isLocalDemo,
    queuedSaleEntries,
    workspace,
  });

  const [checkoutPreparing, setCheckoutPreparing] = useState(false);
  /** The checkout button stays busy until payment opens or preparing it fails. */
  const openCheckout = async () => {
    if (checkoutPreparing) return;
    setCheckoutPreparing(true);
    try {
      await prepareCheckout();
    } finally {
      setCheckoutPreparing(false);
    }
  };

  const prepareCheckout = async () => {
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

    let checkoutSale = sale;
    let checkoutTotal = total;
    if (workspace.cart.isLocalDraft) {
      try {
        const committed = await workspace.commitDraft();
        checkoutSale = committed;
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

    if (checkoutSale?.status === 'OPEN') {
      try {
        checkoutSale = await workspace.refreshPromotionEligibility(checkoutSale);
        checkoutTotal = checkoutSale.totalAmount;
      } catch (error) {
        showToast({
          title: copy('Could not prepare transaction'),
          description: cashierTransactionErrorMessage(error),
          variant: 'danger',
        });
        return;
      }
    }

    const latestPaymentRoutes = await workspace.refreshPaymentRoutes();
    // Returning to a checkout that already has payments resumes with what is still open.
    const openAmount =
      checkoutSale && checkoutSale.payments.length
        ? paymentProgress(checkoutSale).remainingAmount
        : checkoutTotal;
    const normalizedCheckoutTotal = currencyInputFromAmount(openAmount);
    setPaymentAmount(normalizedCheckoutTotal);
    setTender(normalizedCheckoutTotal);
    setPaymentError(null);
    setPayNow(true);
    setPaymentMethod('CASH');
    setPaymentRouteId(
      latestPaymentRoutes.find((route) => route.paymentMethod === 'CASH')?.id ?? '',
    );
    setPaymentReference('');
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const refreshQueue = () => void transactionsQuery.refetch();
  const { customerEditTarget, setCustomerEditTarget, openCustomerEdit, saveCustomerEdit } =
    useQueuedSaleCustomerEdit({
      adapter,
      workspace,
      transactionsQuery,
      queueDetail,
      setQueueDetail,
      refreshQueue,
      showToast,
      copy,
    });

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
    startNewCustomerTransaction();

    // The receipt belongs to a settled transaction; a partly paid one keeps its balance in the queue.
    if (wasPaid && destination === 'QUEUE') {
      setReceiptSaleId(completedSale.id);
      setQueueDetail(completedSale);
    } else {
      setReceiptSaleId(null);
      setQueueDetail(null);
    }

    const partlyPaid = !wasPaid && hasSuccessfulPayment(completedSale);
    showToast({
      title: wasPaid ? copy('Payment successful') : copy('Transaction created'),
      description:
        destination === 'START_PROCESS'
          ? `${transactionNumber(completedSale, workspace.locale)} ${copy('Added to queue and ready to start.')}`
          : wasPaid
            ? `${transactionNumber(completedSale, workspace.locale)} ${copy('Paid and added to queue.')}`
            : partlyPaid
              ? `${transactionNumber(completedSale, workspace.locale)} ${copy('Added to queue. Collect the remaining balance from the queue.')} ${copy('Remaining')}: ${money(financialSummary(completedSale).balanceDue, workspace.locale)}`
              : `${transactionNumber(completedSale, workspace.locale)} ${copy('Added to queue. Payment has not been received.')}`,
      variant: 'success',
    });
  };

  /** An all-INSTANT Sale that finalized at checkout: show its completed receipt, no queue. */
  const commitInstantCheckout = (finalized: Sale) => {
    setQueueTab('COMPLETED');
    setQueueOpen(true);
    setCartOpen(false);
    setCheckoutOpen(false);

    workspace.clearProcessedDraft();
    startNewCustomerTransaction();

    // Same rule as completing queued work: the finalize response is the immediate receipt.
    if (canReadCompleted || hasSuccessfulPayment(finalized)) {
      setQueueDetail(finalized);
      setReceiptSaleId(hasSuccessfulPayment(finalized) ? finalized.id : null);
    } else {
      setQueueDetail(null);
      setReceiptSaleId(null);
    }
    showToast({
      title: copy('Transaction completed'),
      description: `${transactionNumber(finalized, workspace.locale)} ${copy('has been completed.')}`,
      variant: 'success',
    });
  };

  /**
   * The one place that decides what an exactly settled checkout becomes: tracked work queues,
   * an all-INSTANT Sale finalizes immediately. Throws so the caller can keep the payment and retry.
   */
  const finishSettledCheckout = async (settled: Sale) => {
    const result = await completeSettledCheckout(settled, {
      queue: workspace.queueSale,
      finalizeInstant: workspace.finalizeInstantSale,
    });
    if (result.kind === 'FINALIZED') commitInstantCheckout(result.sale);
    else if (result.kind === 'QUEUED') commitCheckoutToQueue(result.sale, true, 'QUEUE');
  };

  const { startQueuedWork, startWaitingServiceLine } = useQueuedWorkActions({
    workspace,
    setQueueTab,
    setQueueDetail,
    showToast,
    copy,
  });

  const openQueuePayment = async (transaction: Sale) => {
    try {
      const { sale: hydrated, availableToPay } = await workspace.hydrateQueuedPayment(
        transaction.id,
      );
      setQueueDetail(null);
      const latestPaymentRoutes = await workspace.refreshPaymentRoutes();
      const normalizedAvailable = currencyInputFromAmount(availableToPay);
      setPaymentMethod('CASH');
      setPaymentRouteId(
        latestPaymentRoutes.find((route) => route.paymentMethod === 'CASH')?.id ?? '',
      );
      setPaymentAmount(normalizedAvailable);
      setPaymentReference('');
      setPaymentError(null);
      setTender(normalizedAvailable);
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

  const queueCheckout = async (destination: FulfillmentDestination) => {
    if (!sale || !lines.length) return;
    try {
      // An all-INSTANT Sale has no queue: it only completes once exactly settled.
      if (!hasTrackedWork(sale)) {
        if (hasSuccessfulCheckout(sale)) await finishSettledCheckout(sale);
        return;
      }
      const submitted = await workspace.queueSale(sale);
      commitCheckoutToQueue(submitted, hasSuccessfulCheckout(sale), destination);
      if (destination === 'START_PROCESS') await startQueuedWork(submitted);
    } catch (error) {
      showToast({
        title: copy('Checkout failed'),
        description: cashierTransactionErrorMessage(error),
        variant: 'danger',
      });
    }
  };

  const recordCheckoutPayment = (allocationOverride?: string) =>
    sendPaymentOnce(async () => {
      if (!sale || !lines.length) return;
      const allocation = normalizeCurrencyPaymentInput(allocationOverride ?? paymentAmount);
      const progress = paymentProgress(sale);
      if (
        !isPositiveDecimal(allocation) ||
        createDecimal(allocation).greaterThan(createDecimal(progress.remainingAmount))
      )
        return;
      const tendered =
        paymentMethod === 'CASH' ? normalizeCurrencyPaymentInput(tender || allocation) : undefined;
      if (tendered && createDecimal(tendered).lessThan(createDecimal(allocation))) return;
      const selectedRoute =
        workspace.paymentRoutes.find(
          (route) => route.id === paymentRouteId && route.paymentMethod === paymentMethod,
        ) ?? workspace.paymentRoutes.find((route) => route.paymentMethod === paymentMethod);
      if (!selectedRoute) {
        setPaymentError(copy('Configure an active settlement account for this payment method.'));
        return;
      }
      let completedSale: Sale;
      try {
        completedSale = await workspace.createPayment(
          paymentMethod,
          allocation,
          tendered,
          paymentReference.trim() || undefined,
          selectedRoute.id,
        );
      } catch (error) {
        setPaymentError(cashierTransactionErrorMessage(error));
        return;
      }

      const next = paymentProgress(completedSale);
      if (!hasSuccessfulCheckout(completedSale)) {
        const waiting = completedSale.payments.some((payment) => payment.status === 'PENDING');
        setPaymentAmount(currencyInputFromAmount(next.remainingAmount));
        setTender(currencyInputFromAmount(next.remainingAmount));
        setPaymentReference('');
        showToast({
          title: copy(waiting ? 'Payment waiting for confirmation' : 'Payment recorded'),
          description: waiting
            ? copy('Confirm the payment once it is received.')
            : `${copy('Remaining')}: ${money(next.remainingAmount, workspace.locale)}`,
          variant: 'success',
        });
        return;
      }

      try {
        await finishSettledCheckout(completedSale);
      } catch (error) {
        showToast({
          title: copy('Payment complete'),
          description: `${cashierTransactionErrorMessage(error)} ${copy(
            hasTrackedWork(completedSale)
              ? 'Payment is preserved. Try adding the transaction to the queue again.'
              : 'Payment is preserved. Try completing the transaction again.',
          )}`,
          variant: 'warning',
        });
      }
    });

  const payQueueBalance = () =>
    sendPaymentOnce(async () => {
      const transaction = displayedQueuePaymentTarget;
      if (!transaction || !queuePaymentAmount) return;
      const due = currencyInputFromAmount(queuePaymentAmount);
      const allocation = normalizeCurrencyPaymentInput(paymentAmount);
      if (
        !isPositiveDecimal(allocation) ||
        createDecimal(allocation).greaterThan(createDecimal(due))
      )
        return;
      const tendered =
        paymentMethod === 'CASH' ? normalizeCurrencyPaymentInput(tender || allocation) : undefined;
      if (tendered && createDecimal(tendered).lessThan(createDecimal(allocation))) return;
      const selectedRoute =
        workspace.paymentRoutes.find(
          (route) => route.id === paymentRouteId && route.paymentMethod === paymentMethod,
        ) ?? workspace.paymentRoutes.find((route) => route.paymentMethod === paymentMethod);
      if (!selectedRoute) {
        setPaymentError(copy('Configure an active settlement account for this payment method.'));
        return;
      }
      try {
        const updatedSale = await workspace.createQueuedPayment(
          transaction,
          paymentMethod,
          allocation,
          tendered,
          paymentReference.trim() || undefined,
          selectedRoute.id,
        );
        const next = paymentProgress(updatedSale);
        const settled = hasSuccessfulCheckout(updatedSale);
        const waiting = updatedSale.payments.some((payment) => payment.status === 'PENDING');
        setQueuePaymentTarget(updatedSale);
        setQueuePaymentAmount(next.remainingAmount);
        setPaymentAmount(currencyInputFromAmount(next.remainingAmount));
        setTender(currencyInputFromAmount(next.remainingAmount));
        setPaymentReference('');
        if (settled) {
          setQueuePaymentTarget(null);
          setQueuePaymentAmount(null);
          setQueueDetail(updatedSale);
          setReceiptSaleId(updatedSale.id);
          workspace.closeQueueContext();
        }
        showToast({
          title: settled
            ? copy('Payment complete')
            : copy(waiting ? 'Payment waiting for confirmation' : 'Payment recorded'),
          description: settled
            ? copy('Transaction payment is complete.')
            : waiting
              ? copy('Confirm the payment once it is received.')
              : `${copy('Remaining')}: ${money(next.remainingAmount, workspace.locale)}`,
          variant: 'success',
        });
      } catch (error) {
        setPaymentError(cashierTransactionErrorMessage(error));
      }
    });

  const transitionCheckoutPayment = async (payment: Payment, status: TerminalPaymentStatus) => {
    try {
      const updatedSale = await workspace.transitionPayment(payment, status);
      const nextAllocation = paymentProgress(updatedSale);
      setPaymentAmount(currencyInputFromAmount(nextAllocation.remainingAmount));
      setTender(currencyInputFromAmount(nextAllocation.remainingAmount));
      setPaymentReference('');
      if (hasSuccessfulCheckout(updatedSale)) {
        try {
          await finishSettledCheckout(updatedSale);
          return;
        } catch (error) {
          showToast({
            title: copy('Payment complete'),
            description: `${cashierTransactionErrorMessage(error)} ${copy(
              hasTrackedWork(updatedSale)
                ? 'Payment is preserved. Try adding the transaction to the queue again.'
                : 'Payment is preserved. Try completing the transaction again.',
            )}`,
            variant: 'warning',
          });
          return;
        }
      }
      showToast({
        title: copy(status === 'SUCCEEDED' ? 'Payment recorded' : 'Payment updated'),
        description: isPositiveDecimal(nextAllocation.remainingAmount)
          ? `${copy('Remaining')}: ${money(nextAllocation.remainingAmount, workspace.locale)}`
          : copy('Resolve pending payments before continuing.'),
        variant: status === 'SUCCEEDED' ? 'success' : 'warning',
      });
    } catch (error) {
      showToast({
        title: copy('Payment failed'),
        description: cashierTransactionErrorMessage(error),
        variant: 'danger',
      });
    }
  };

  const transitionQueuePayment = async (payment: Payment, status: TerminalPaymentStatus) => {
    const transaction = displayedQueuePaymentTarget;
    if (!transaction) return;
    try {
      const updatedSale = await workspace.transitionQueuedPayment(transaction, payment, status);
      const nextAllocation = paymentProgress(updatedSale);
      setQueuePaymentTarget(updatedSale);
      setQueuePaymentAmount(nextAllocation.remainingAmount);
      setPaymentAmount(currencyInputFromAmount(nextAllocation.remainingAmount));
      setTender(currencyInputFromAmount(nextAllocation.remainingAmount));
      setPaymentReference('');
      if (hasSuccessfulCheckout(updatedSale)) {
        setQueuePaymentTarget(null);
        setQueuePaymentAmount(null);
        setQueueDetail(updatedSale);
        setReceiptSaleId(updatedSale.id);
        workspace.closeQueueContext();
      }
      showToast({
        title: copy(status === 'SUCCEEDED' ? 'Payment recorded' : 'Payment updated'),
        description: hasSuccessfulCheckout(updatedSale)
          ? copy('Transaction payment is complete.')
          : `${copy('Remaining')}: ${money(
              financialSummary(updatedSale).balanceDue,
              workspace.locale,
            )}`,
        variant: status === 'SUCCEEDED' ? 'success' : 'warning',
      });
    } catch (error) {
      showToast({
        title: copy('Payment failed'),
        description: cashierTransactionErrorMessage(error),
        variant: 'danger',
      });
    }
  };

  const quickTender = ['50000', '100000', '150000', '200000', '500000'];

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
          canAdjust={(transaction) => canAdjustOrder(transaction, session.access.permissions)}
          onPay={(transaction) => void openQueuePayment(transaction)}
          onCancel={requestCancel}
          onEditCustomer={openCustomerEdit}
          onView={(transaction) => {
            // A queue card is a polling projection. Show it immediately, then
            // replace it with the authoritative transaction response so detail
            // facts such as an OPEN Sale's loyalty-redemption intent never
            // depend on which queue projection was cached first.
            setQueueDetail(transaction);
            void adapter
              .getSale(transaction.id)
              .then(setQueueDetail)
              .catch((error) =>
                showToast({
                  title: copy('Could not load transaction'),
                  description: cashierTransactionErrorMessage(error),
                  variant: 'danger',
                }),
              );
          }}
          onViewReceipt={(transaction) => {
            setQueueDetail(transaction);
            setReceiptSaleId(transaction.id);
          }}
          canReadCompleted={canReadCompleted}
          onSendReceipt={openReceiptDelivery}
          receiptDeliveries={transactionsQuery.data?.receiptDeliveries ?? {}}
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
                icon={<Sparkles className="size-3.5" />}
                label={copy('Service')}
                onClick={() => selectType('SERVICE')}
              />
            </div>
            <div className="shrink-0">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={copy('Search item or variant...')}
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
                  className={`inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold transition-colors ${selectedCategory ? 'bg-(--color-surface-muted) text-(--color-text-muted)' : 'bg-(--color-brand) text-white'}`}
                >
                  {copy('All')}
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className={`inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold transition-colors ${selectedCategory === category.id ? 'bg-(--color-brand) text-white' : 'bg-(--color-surface-muted) text-(--color-text-muted)'}`}
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
                <Skeleton key={`${String(item)}-${index}`} className="aspect-3/4 rounded-2xl" />
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex min-h-65 items-center justify-center rounded-2xl border border-dashed border-(--color-border) bg-(--color-surface)/50 text-sm text-(--color-text-muted)">
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
        total={pricingPreview?.totalAmount ?? cartPreviewTotal}
        gross={pricingPreview?.grossAmount ?? workspace.cart.grossAmount}
        discountAmount={pricingPreview?.discountAmount ?? workspace.cart.discountAmount}
        {...(pricingPreview ? { discountRows: pricingPreview.discountRows } : {})}
        isPricingPreviewed={pricingPreview !== null}
        discountLabel={
          sale
            ? transactionDiscountLabel(sale, copy('Promotions and discounts'))
            : copy('Promotions and discounts')
        }
        taxAmount={pricingPreview?.taxAmount ?? draftTaxAmount}
        taxLabel={
          pricingPreview?.taxLabel ?? (sale ? saleTaxLabel(sale, copy('Tax')) : draftTaxLabel)
        }
        isEstimate={workspace.cart.isLocalDraft}
        isTaxPreviewLoading={!pricingPreview && isTaxPreviewLoading}
        isTaxPreviewUnavailable={!pricingPreview && isTaxPreviewUnavailable}
        locale={workspace.locale}
        customer={cartCustomer}
        memberNumber={activeSelectedMember?.memberNumber ?? null}
        pointBalance={memberBalanceQuery.data?.pointsBalance ?? null}
        isPointBalanceLoading={memberBalanceQuery.isLoading}
        onChooseCustomer={() => setCustomerPickerOpen(true)}
        onQuantity={(line, next) => {
          if (workspace.cart.isLocalDraft) workspace.changeDraftQuantity(line.id, next);
          else {
            const serverLine = workspace.viewModel.activeLines.find((item) => item.id === line.id);
            if (serverLine) workspace.changeQuantity(serverLine, next);
          }
        }}
        onEdit={(line, options) => void workspace.editCartLine(line.id, options)}
        onRemove={(line) => {
          if (workspace.cart.isLocalDraft) workspace.removeDraftLine(line.id);
          else {
            const serverLine = workspace.viewModel.activeLines.find((item) => item.id === line.id);
            if (serverLine) workspace.removeLine(serverLine);
          }
        }}
        onCheckout={() => void openCheckout()}
        isCheckoutPreparing={checkoutPreparing}
      />

      <CustomerMemberDialog
        key={customerCacheScope}
        open={customerPickerOpen}
        customer={cartCustomer}
        isSaving={workspace.isCustomerPending}
        api={customerMemberApi}
        canReadMembers={canReadMembers}
        canEnrollMember={canEnrollMember}
        canReadCustomers={canReadCustomers}
        canReadLoyalty={canReadLoyalty}
        resetKey={customerPickerSession.revision}
        onClose={() => setCustomerPickerOpen(false)}
        onChoose={(selection, member) => {
          const previousMember = selectedMember;
          setSelectedMember(member ?? null);
          void workspace
            .changeCustomer(selection)
            .then(() => {
              setCustomerPickerOpen(false);
            })
            .catch((error: unknown) => {
              setSelectedMember(previousMember);
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
        {...(sale &&
        sale.status === 'OPEN' &&
        workspace.viewModel.monetaryMutation.state === 'AVAILABLE'
          ? {
              onEditOrder: () => {
                setCheckoutOpen(false);
                setCartOpen(true);
              },
            }
          : {})}
        sale={sale}
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
        customer={cartCustomer}
        paymentRoutes={workspace.paymentRoutes}
        isPaymentRoutesLoading={workspace.isLoadingPaymentRoutes}
        method={paymentMethod}
        paymentRouteId={paymentRouteId}
        appliedAmount={paymentAmount}
        paymentReference={paymentReference}
        tender={tender}
        payNow={payNow}
        onPayNowChange={setPayNow}
        onMethod={(next) => {
          setPaymentError(null);
          setPaymentMethod(next);
          setPaymentRouteId(
            workspace.paymentRoutes.find((route) => route.paymentMethod === next)?.id ?? '',
          );
          setPaymentReference('');
          if (next === 'CASH') setTender(paymentAmount);
        }}
        onPaymentRoute={(routeId) => {
          setPaymentError(null);
          setPaymentRouteId(routeId);
        }}
        onAppliedAmount={(amount) => {
          setPaymentError(null);
          setPaymentAmount(amount);
          if (paymentMethod === 'CASH') setTender(amount);
        }}
        onPaymentReference={setPaymentReference}
        onTender={setTender}
        onTransitionPayment={(payment, status) => void transitionCheckoutPayment(payment, status)}
        quickTender={quickTender}
        isSubmitting={workspace.isCoreMutating || isRecordingPayment}
        paymentError={paymentError}
        onConfirmPayment={recordCheckoutPayment}
        onQueue={() => void queueCheckout('QUEUE')}
        onQueueWithBalance={() => void queueCheckout('QUEUE')}
        loyaltyRedemption={sale?.loyaltyRedemption ?? null}
        loyaltyPointBalance={
          activeSelectedMember ? (memberBalanceQuery.data?.pointsBalance ?? null) : null
        }
        isLoyaltyBalanceLoading={
          Boolean(activeSelectedMember) &&
          (memberBalanceQuery.isLoading || memberIdentityQuery.isLoading)
        }
        canRedeemLoyalty={Boolean(sale) && canRedeemLoyalty && activeCustomer?.type === 'MEMBER'}
        loyaltyPoints={loyaltyPoints}
        isLoyaltyMutating={workspace.isLoyaltyRedemptionPending}
        onLoyaltyPointsChange={setLoyaltyPoints}
        onApplyLoyalty={(points) => workspace.applyLoyaltyRedemption(points)}
        onRemoveLoyalty={() => {
          workspace.removeLoyaltyRedemption();
          setLoyaltyPoints('');
        }}
        adjustmentSlot={<SaleAdjustmentControls workspace={workspace} placement="payment" />}
      />

      <ReferenceTransactionDetail
        sale={presentableTransaction(displayedQueueDetail, canReadCompleted, receiptSaleId)}
        locale={workspace.locale}
        employees={workspace.employees}
        businessName={runtime.branding.businessName ?? runtime.branding.productName}
        branchName={receiptLocation?.name ?? copy('Main branch')}
        branchAddress={receiptLocation?.address ?? null}
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
          // A partly paid all-INSTANT Sale has no queue: keep it as the active transaction.
          if (workspace.isNewSaleBlocked) {
            showToast({
              title: copy('Transaction not finished'),
              description: copy(
                'Finish the payment of this transaction before starting a new one.',
              ),
              variant: 'warning',
            });
            return;
          }
          setQueueDetail(null);
          setReceiptSaleId(null);
          setCartOpen(false);
          if (workspace.newSale()) startNewCustomerTransaction();
        }}
        onViewReceipt={(transaction) => {
          setQueueDetail(transaction);
          setReceiptSaleId(transaction.id);
        }}
        onSendReceipt={openReceiptDelivery}
        {...(displayedQueueDetail?.status === 'FINALIZED' && receiptDeliveryStatusQuery.data
          ? { deliveryStatus: receiptDeliveryStatusQuery.data }
          : {})}
        onAssign={(line) => {
          if (!displayedQueueDetail) return;
          workspace.requestEmployeeOptions();
          setPerformerTarget({ sale: displayedQueueDetail, line });
        }}
        onStartLineWork={(line) => {
          if (!displayedQueueDetail) return;
          void startWaitingServiceLine(displayedQueueDetail, line);
        }}
        onComplete={() => {
          if (displayedQueueDetail) void completeQueuedTransaction(displayedQueueDetail);
        }}
        isMutating={workspace.isCoreMutating}
      />

      <ReferenceOrderAdjustmentDialog
        key={displayedAdjustmentTarget?.id ?? 'adjustment-closed'}
        sale={displayedAdjustmentTarget}
        // Every active sellable item: the page's Product/Service filter and search never apply.
        items={workspace.activeItems}
        locale={workspace.locale}
        isMutating={workspace.isCoreMutating}
        onClose={() => {
          workspace.closeVariantPicker();
          setAdjustmentTarget(null);
          workspace.closeQueueContext();
        }}
        onAdd={(item, configuration) => workspace.addItemToTransaction(item, configuration)}
        onQuantity={(line, next) => workspace.changeQuantity(line, next)}
        onRemove={workspace.removeLine}
        onEdit={(line, input) => workspace.correctLine(line, input)}
        onCorrect={(line, input) => workspace.correctLine(line, input)}
        onPreview={(line, input) => workspace.previewLineCorrection(line, input)}
        loadConfiguratorState={workspace.loadConfiguratorState}
        loadCandidates={workspace.loadComponentCandidates}
        canAdjust={
          displayedAdjustmentTarget
            ? canAdjustOrder(displayedAdjustmentTarget, session.access.permissions)
            : true
        }
        canRefundPayment={session.access.permissions.includes('payments:refund')}
        onCompensate={(sale, paymentId, amount) =>
          workspace.compensateOpenPayment(sale, paymentId, amount)
        }
        employees={workspace.employees}
      />

      <ReferenceBalancePaymentDialog
        sale={displayedQueuePaymentTarget}
        availableToPay={queuePaymentAmount}
        locale={workspace.locale}
        paymentRoutes={workspace.paymentRoutes}
        isPaymentRoutesLoading={workspace.isLoadingPaymentRoutes}
        method={paymentMethod}
        paymentRouteId={paymentRouteId}
        appliedAmount={paymentAmount}
        paymentReference={paymentReference}
        tender={tender}
        isMutating={workspace.isCoreMutating || isRecordingPayment}
        paymentError={paymentError}
        onClose={() => {
          setPaymentError(null);
          setQueuePaymentTarget(null);
          setQueuePaymentAmount(null);
          workspace.closeQueueContext();
        }}
        onMethod={(next) => {
          setPaymentError(null);
          setPaymentMethod(next);
          setPaymentRouteId(
            workspace.paymentRoutes.find((route) => route.paymentMethod === next)?.id ?? '',
          );
          setPaymentReference('');
          if (next === 'CASH') setTender(paymentAmount);
        }}
        onPaymentRoute={(routeId) => {
          setPaymentError(null);
          setPaymentRouteId(routeId);
        }}
        onAppliedAmount={(amount) => {
          setPaymentError(null);
          setPaymentAmount(amount);
          if (paymentMethod === 'CASH') setTender(amount);
        }}
        onPaymentReference={setPaymentReference}
        onTender={setTender}
        onTransitionPayment={(payment, status) => void transitionQueuePayment(payment, status)}
        onPay={payQueueBalance}
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

      <WalkInCustomerEditDialog
        target={customerEditTarget}
        onClose={() => setCustomerEditTarget(null)}
        onSave={saveCustomerEdit}
      />

      <ReceiptDeliveryDialog
        target={receiptDeliveryTarget}
        commands={adapter}
        onClose={() => setReceiptDeliveryTarget(null)}
        onDeliveryChanged={refreshQueue}
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
