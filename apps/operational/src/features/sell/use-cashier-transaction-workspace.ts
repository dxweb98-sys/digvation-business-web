import { useAuth } from '@digvation/pos-auth';
import { useConnectivity, useRuntime } from '@digvation/pos-runtime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  referenceQueryPolicy,
  transactionQueryPolicy,
} from '../../app/data/operational-cache-policy';
import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../app/localization/operational-localization';
import { useCashierSession } from '../../app/providers/cashier-session-provider';
import type { VariantPickerContext, VariantPickerState } from './components/variant-picker';
import {
  createCashierTransactionAdapter,
  isLocalCashierDemoEnabled,
} from './cashier-transaction-adapter-factory';
import { cashierTransactionErrorMessage } from './cashier-transaction-errors';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import type {
  CatalogItem,
  CatalogVariant,
  Payment,
  PaymentMethod,
  PaymentStatus,
  QueueSale,
  Sale,
  SaleLine,
} from './cashier-transaction.types';
import { isCompletedSaleSummary } from './completed-sale-visibility';
import { fetchResolvedPrice, fetchResolvedVariantPrices } from './resolved-price-query';
import type { ServiceLineWorkPlan } from './service-performer-allocation';
import { createSaleWorkspaceViewModel } from './sale-workspace-view-model';
import { useEmployeeOptions } from './use-employee-options';
import { useSaleCommandCoordinator } from './use-sale-command-coordinator';
import { useSaleCoreController } from './use-sale-core-controller';
import { useSaleWorkspaceController } from './use-sale-workspace-controller';
import { useSellingCatalog } from './use-selling-catalog';

export function useCashierTransactionWorkspace(routeSaleId?: string) {
  const runtime = useRuntime();
  const operationalLocale = resolveOperationalLocale(runtime.locale);
  const copy = (value: string) => operationalCopy(value, operationalLocale);
  const { authPort } = useAuth();
  const queryClient = useQueryClient();
  const connectivity = useConnectivity();
  const navigate = useNavigate();
  const { selectedLocationId, selectLocation, rememberSale } = useCashierSession();
  const [variantPicker, setVariantPicker] = useState<VariantPickerState | null>(null);
  const [lineTaskId, setLineTaskId] = useState<string | null>(null);
  const [isCompletionOpen, setCompletionOpen] = useState(false);
  const [queueContextSale, setQueueContextSale] = useState<Sale | null>(null);
  const [areEmployeeOptionsEnabled, setEmployeeOptionsEnabled] = useState(true);
  const pendingPerformerIntent = useRef<{ lineId: string; token: symbol } | null>(null);
  const transactionAdapter = useMemo(
    () => createCashierTransactionAdapter(runtime, authPort.getAccessToken?.bind(authPort)),
    [authPort, runtime],
  );
  const effectiveConnectivity = isLocalCashierDemoEnabled() ? 'ONLINE' : connectivity.state;

  // The queue keeps itself fresh through its own polling query, which pauses
  // while the tab is in the background. A second timer here would refetch the
  // same list twice as often, including while nobody is looking at it.

  const command = useSaleCommandCoordinator({ client: transactionAdapter, rememberSale });

  const catalog = useSellingCatalog({
    query: transactionAdapter,
    locale: runtime.locale,
    sellingLocationId: selectedLocationId ?? '',
    currency: runtime.currency,
  });

  const employeeOptions = useEmployeeOptions(transactionAdapter, areEmployeeOptionsEnabled);
  const paymentRoutesQuery = useQuery({
    queryKey: cashierTransactionKeys.paymentRoutes(selectedLocationId ?? '', runtime.currency),
    queryFn: ({ signal }) =>
      transactionAdapter.listPaymentRoutes(
        { sellingLocationId: selectedLocationId!, currency: runtime.currency },
        signal,
      ),
    enabled: Boolean(selectedLocationId && runtime.currency),
    ...referenceQueryPolicy,
  });

  const refreshPaymentRoutes = async () => {
    const result = await paymentRoutesQuery.refetch();
    return (result.data?.items ?? []).filter((route) => route.status === 'ACTIVE');
  };

  const activeSaleId = routeSaleId ?? undefined;
  const saleWorkspace = useSaleWorkspaceController({
    client: transactionAdapter,
    command,
    ...(activeSaleId === undefined ? {} : { routeSaleId: activeSaleId }),
    selectedLocationId,
    currency: runtime.currency,
    locale: runtime.locale,
    connectivity: effectiveConnectivity,
    selectLocation,
    rememberSale,
  });

  const core = useSaleCoreController({
    client: transactionAdapter,
    command,
    sale: saleWorkspace.sale,
    connectivity: effectiveConnectivity,
  });

  const lineTask =
    saleWorkspace.sale?.lines.find((line) => line.id === lineTaskId && line.removedAt === null) ??
    null;

  const contributionPreviewQuery = useQuery({
    queryKey: cashierTransactionKeys.contributionPreview(
      saleWorkspace.sale?.id ?? 'idle',
      lineTask?.id ?? 'idle',
    ),
    queryFn: ({ signal }) =>
      transactionAdapter.getSaleLineContributionPreview(
        saleWorkspace.sale!.id,
        lineTask!.id,
        signal,
      ),
    enabled: Boolean(saleWorkspace.sale && lineTask?.allowEmployeeContributionSnapshot),
    ...transactionQueryPolicy,
  });

  const cacheQueueContext = (sale: Sale) => {
    command.commitSale(sale);
    setQueueContextSale(sale);
    return sale;
  };

  const closeQueueContext = () => {
    setQueueContextSale(null);
    setVariantPicker(null);
    setCompletionOpen(false);
    setLineTaskId(null);
    command.clearAttention();
  };

  /**
   * Promotion eligibility is time-sensitive. Every explicit refresh uses a new
   * idempotency key so an earlier successful refresh can never freeze a later
   * eligibility decision, while Runtime remains the monetary authority.
   */
  const refreshPromotionEligibility = async (targetSale: Sale) => {
    command.clearNotice();
    try {
      const updated = await command.runMutation(() =>
        transactionAdapter.refreshPromotionEligibility(
          targetSale.id,
          targetSale.version,
          `cashier-promotion-refresh-${crypto.randomUUID()}`,
        ),
      );
      command.commitSale(updated);
      if (queueContextSale?.id === updated.id) setQueueContextSale(updated);
      return updated;
    } catch (error) {
      command.reportError(error);
      throw error;
    }
  };

  const findCachedQueueSale = (saleId: string): Sale | null => {
    const direct = queryClient.getQueryData<Sale>(cashierTransactionKeys.sale(saleId));
    if (direct) return direct;
    const queue = queryClient.getQueryData<{ items: QueueSale[] }>(cashierTransactionKeys.sales());
    const entry = queue?.items.find((candidate) => candidate.id === saleId);
    // A completed-sale summary is not a Sale; the authoritative read decides access.
    return entry && !isCompletedSaleSummary(entry) ? entry : null;
  };

  const loadQueueContext = async (saleId: string) => {
    const cached = findCachedQueueSale(saleId);
    if (cached) setQueueContextSale(cached);
    const authoritative = await transactionAdapter.getSale(saleId);
    return cacheQueueContext(authoritative);
  };

  const openQueueContext = (saleId: string) => {
    setCompletionOpen(false);
    setLineTaskId(null);
    command.clearAttention();
    const cached = findCachedQueueSale(saleId);
    if (cached) setQueueContextSale(cached);
    void loadQueueContext(saleId).catch((error) => command.reportError(error));
  };

  const addCatalogItem = async (
    item: CatalogItem,
    catalogVariantId: string | undefined,
    context: VariantPickerContext,
    targetSaleId?: string,
    catalogVariant: CatalogVariant | null = null,
  ) => {
    if (context === 'TRANSACTION_ADJUSTMENT') {
      if (!targetSaleId) {
        throw new Error(
          copy('The transaction being adjusted is no longer active. Reopen the adjustment.'),
        );
      }
      const target =
        queueContextSale?.id === targetSaleId
          ? queueContextSale
          : (findCachedQueueSale(targetSaleId) ?? (await loadQueueContext(targetSaleId)));
      const updated = await command.runMutation(() =>
        transactionAdapter.addSaleLine(
          target.id,
          {
            expectedVersion: target.version,
            catalogItemId: item.id,
            ...(catalogVariantId ? { catalogVariantId } : {}),
            quantity: '1',
          },
          `cashier-adjust-add-line-${crypto.randomUUID()}`,
        ),
      );
      cacheQueueContext(updated);
      return;
    }

    if (!selectedLocationId) {
      saleWorkspace.addItem(item.id, catalogVariantId);
      return;
    }
    const resolvedPrice = await fetchResolvedPrice(queryClient, transactionAdapter, {
      catalogItemId: item.id,
      ...(catalogVariantId ? { catalogVariantId } : {}),
      sellingLocationId: selectedLocationId,
      currency: runtime.currency,
    });

    saleWorkspace.addItem(item.id, catalogVariantId, {
      catalogItem: item,
      catalogVariant,
      resolvedPrice,
    });
  };

  const selectItem = async (item: CatalogItem, context: VariantPickerContext = 'CART') => {
    command.clearNotice();
    try {
      const targetSaleId =
        context === 'TRANSACTION_ADJUSTMENT' ? (queueContextSale?.id ?? undefined) : undefined;
      if (context === 'TRANSACTION_ADJUSTMENT' && !targetSaleId) {
        throw new Error(
          copy('The transaction being adjusted is no longer active. Reopen the adjustment.'),
        );
      }
      const variants = await catalog.loadActiveVariants(item);
      if (variants.length > 0) {
        const resolvedVariants = selectedLocationId
          ? await fetchResolvedVariantPrices(queryClient, transactionAdapter, {
              catalogItemId: item.id,
              catalogVariantIds: variants.map((variant) => variant.id),
              sellingLocationId: selectedLocationId,
              currency: runtime.currency,
            })
          : { pricesByVariantId: {}, unavailableVariantIds: [] };
        // The item itself is a choice only when Catalog sells it without a variant.
        const itemOption =
          item.variantSelectionMode === 'OPTIONAL'
            ? {
                price: selectedLocationId
                  ? await fetchResolvedPrice(queryClient, transactionAdapter, {
                      catalogItemId: item.id,
                      sellingLocationId: selectedLocationId,
                      currency: runtime.currency,
                    }).then(
                      (price) => price.amount,
                      () => null,
                    )
                  : null,
              }
            : null;
        setVariantPicker({
          item,
          variants,
          itemOption,
          pricesByVariantId: resolvedVariants.pricesByVariantId,
          unavailableVariantIds: resolvedVariants.unavailableVariantIds,
          locale: runtime.locale,
          currency: runtime.currency,
          context,
          ...(targetSaleId ? { targetSaleId } : {}),
        });
        return;
      }
      await addCatalogItem(item, undefined, context, targetSaleId);
    } catch (error) {
      command.reportError(error);
    }
  };

  const selectVariant = async (catalogVariantId: string | null) => {
    if (!variantPicker) return;
    const item = variantPicker.item;
    const context = variantPicker.context ?? 'CART';
    const targetSaleId = variantPicker.targetSaleId;
    const catalogVariant =
      variantPicker.variants.find((variant) => variant.id === catalogVariantId) ?? null;
    setVariantPicker(null);
    try {
      await addCatalogItem(
        item,
        catalogVariantId ?? undefined,
        context,
        targetSaleId,
        catalogVariant,
      );
    } catch (error) {
      command.reportError(error);
    }
  };

  const newSale = () => {
    if (saleWorkspace.sale?.status === 'OPEN') {
      const confirmed = window.confirm(
        copy('Start a new transaction? The current transaction will remain open.'),
      );
      if (!confirmed) return;
    }
    navigate('/sell');
    closeQueueContext();
    saleWorkspace.clearDraft();
  };

  const clearProcessedDraft = () => {
    if (queueContextSale) {
      closeQueueContext();
      return;
    }
    navigate('/sell');
    setCompletionOpen(false);
    setLineTaskId(null);
    command.clearAttention();
    saleWorkspace.clearDraft();
  };

  const hydrateQueuedSale = async (saleId: string) => {
    setCompletionOpen(false);
    setLineTaskId(null);
    command.clearAttention();
    try {
      return await loadQueueContext(saleId);
    } catch (error) {
      command.reportError(error);
      throw new Error(copy('The latest transaction could not be loaded.'));
    }
  };

  const hydrateQueuedPayment = async (saleId: string) => {
    const hydrated = await hydrateQueuedSale(saleId);
    const current =
      hydrated.status === 'OPEN' ? await refreshPromotionEligibility(hydrated) : hydrated;
    const readiness = createSaleWorkspaceViewModel(
      current,
      effectiveConnectivity,
      'CLEAN',
      runtime.locale,
    );
    if (readiness.paymentMutation.state !== 'AVAILABLE') {
      throw new Error(copy('The latest transaction cannot accept another payment.'));
    }
    return { sale: current, availableToPay: readiness.availableToPay };
  };

  const cachedCardDisplayPrice = (itemId: string) =>
    catalog.items.find((candidate) => candidate.id === itemId)?.displayPrice ?? null;

  const cachedCardPrice = (itemId: string): string | null =>
    cachedCardDisplayPrice(itemId)?.amount ?? null;

  const retryLastCommand = () => {
    if (core.canRetryLastCoreCommand) core.retryLastCoreCommand();
    else saleWorkspace.retryLastAdd();
  };

  const openLineTask = (line: SaleLine) => {
    setEmployeeOptionsEnabled(true);
    setLineTaskId(line.id);
  };

  const changeQuantity = (line: SaleLine, quantity: string) => {
    if (!queueContextSale || queueContextSale.id !== line.saleId) {
      saleWorkspace.changeQuantity(line, quantity);
      return;
    }
    const target = queueContextSale;
    void command
      .runMutation(() =>
        transactionAdapter.setSaleLineQuantity(target.id, line.id, {
          expectedVersion: target.version,
          quantity,
        }),
      )
      .then(cacheQueueContext)
      .catch((error) => command.reportError(error));
  };

  const removeLine = (line: SaleLine) => {
    if (!queueContextSale || queueContextSale.id !== line.saleId) {
      saleWorkspace.removeLine(line);
      return;
    }
    const target = queueContextSale;
    void command
      .runMutation(() => transactionAdapter.removeSaleLine(target.id, line.id, target.version))
      .then(cacheQueueContext)
      .catch((error) => command.reportError(error));
  };

  const transitionQueuedFulfillment = async (
    sale: Sale,
    line: SaleLine,
    status: 'IN_PROGRESS' | 'COMPLETED',
  ) => {
    command.clearNotice();
    try {
      const updated = await command.runMutation(() =>
        transactionAdapter.transitionSaleLineFulfillment(sale.id, line.id, {
          expectedVersion: sale.version,
          status,
        }),
      );
      command.commitSale(updated);
      if (queueContextSale?.id === updated.id) setQueueContextSale(updated);
      return updated;
    } catch (error) {
      command.reportError(error);
      throw error;
    }
  };

  const startQueuedFulfillment = async (sale: Sale, preferredLine: SaleLine) => {
    command.clearNotice();
    try {
      let current = (await command.refetchSale(sale.id)) ?? sale;
      const waitingLineIds = current.lines
        .filter(
          (line) =>
            line.removedAt === null &&
            line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
            line.fulfillment?.status === 'WAITING',
        )
        .map((line) => line.id);
      const orderedLineIds = [
        preferredLine.id,
        ...waitingLineIds.filter((lineId) => lineId !== preferredLine.id),
      ].filter((lineId) => waitingLineIds.includes(lineId));
      if (!orderedLineIds.length) {
        throw new Error(copy('No queued work remains to start.'));
      }
      for (const lineId of orderedLineIds) {
        current = await command.runMutation(() =>
          transactionAdapter.transitionSaleLineFulfillment(current.id, lineId, {
            expectedVersion: current.version,
            status: 'IN_PROGRESS',
          }),
        );
      }
      command.commitSale(current);
      if (queueContextSale?.id === current.id) setQueueContextSale(current);
      return current;
    } catch (error) {
      command.reportError(error);
      throw error;
    }
  };

  const queueSale = async (sale: Sale) => {
    const updated = await command.runMutation(() =>
      transactionAdapter.queueSale(sale.id, sale.version, `cashier-queue-${crypto.randomUUID()}`),
    );
    command.commitSale(updated);
    return updated;
  };

  const startSaleWork = async (sale: Sale) => {
    const authoritative = await transactionAdapter.getSale(sale.id);
    const updated = await command.runMutation(() =>
      transactionAdapter.startSaleWork(
        authoritative.id,
        authoritative.version,
        `cashier-start-work-${crypto.randomUUID()}`,
      ),
    );
    command.commitSale(updated);
    if (queueContextSale?.id === updated.id) setQueueContextSale(updated);
    return updated;
  };

  const setCurrentPerformers = async (
    line: SaleLine,
    performers: Array<{ employeeId: string; shareRate?: string }>,
  ) => {
    const current = saleWorkspace.sale;
    if (!current || current.status !== 'OPEN') return;
    command.clearNotice();
    try {
      const updated = await command.runMutation(() =>
        transactionAdapter.setSaleLinePerformers(current.id, line.id, {
          expectedVersion: current.version,
          performers,
        }),
      );
      command.commitSale(updated);
      void queryClient.invalidateQueries({
        queryKey: cashierTransactionKeys.contributionPreview(current.id, line.id),
      });
    } catch (error) {
      await command.recoverFailure(error, current.id);
    }
  };

  const setAssignments = (line: SaleLine, employeeIds: string[]) => {
    if (line.itemTypeSnapshot !== 'SERVICE') {
      core.setAssignments(line, employeeIds);
      return;
    }
    const token = Symbol(line.id);
    pendingPerformerIntent.current = { lineId: line.id, token };
    queueMicrotask(() => {
      const pending = pendingPerformerIntent.current;
      if (!pending || pending.lineId !== line.id || pending.token !== token) return;
      pendingPerformerIntent.current = null;
      void setCurrentPerformers(
        line,
        employeeIds.map((employeeId) => ({ employeeId })),
      );
    });
  };

  const setContributions = (
    line: SaleLine,
    contributors: Array<{ employeeId: string; shareRate?: string }>,
  ) => {
    if (line.itemTypeSnapshot !== 'SERVICE') {
      core.setContributions(line, contributors);
      return;
    }
    pendingPerformerIntent.current = null;
    void setCurrentPerformers(line, contributors);
  };

  /**
   * Persists who performs each unit of the given service lines and their share
   * of it. Lines are saved one after another on the latest Sale version.
   */
  const setQueuedWorkUnits = async (sale: Sale, plans: readonly ServiceLineWorkPlan[]) => {
    command.clearNotice();
    try {
      if (!transactionAdapter.setSaleLineWorkUnits)
        throw new Error(copy('Work units are not available for this transaction.'));
      let current = await transactionAdapter.getSale(sale.id);
      for (const plan of plans) {
        const liveLine = current.lines.find(
          (candidate) => candidate.id === plan.lineId && candidate.removedAt === null,
        );
        if (!liveLine) throw new Error(copy('The service line is no longer available.'));
        const base = current;
        current = await command.runMutation(() =>
          transactionAdapter.setSaleLineWorkUnits!(base.id, liveLine.id, {
            expectedVersion: base.version,
            units: plan.units.map((performers) => ({ performers })),
          }),
        );
        command.commitSale(current);
      }
      if (queueContextSale?.id === current.id) setQueueContextSale(current);
      return current;
    } catch (error) {
      command.reportError(error);
      throw error;
    }
  };

  const finalizeQueuedSale = async (sale: Sale) => {
    command.clearNotice();
    try {
      let current = (await command.refetchSale(sale.id)) ?? sale;
      const trackedLines = current.lines.filter(
        (line) => line.removedAt === null && line.fulfillmentBehaviorSnapshot === 'TRACKED',
      );
      if (trackedLines.some((line) => line.fulfillment?.status === 'WAITING')) {
        throw new Error(copy('Start all work before completing the transaction.'));
      }
      if (
        trackedLines.some((line) => !line.fulfillment || line.fulfillment.status === 'CANCELED')
      ) {
        throw new Error(copy('Canceled work cannot be completed as an active transaction.'));
      }
      for (const trackedLine of trackedLines) {
        const liveLine = current.lines.find((line) => line.id === trackedLine.id);
        if (liveLine?.fulfillment?.status !== 'IN_PROGRESS') continue;
        current = await command.runMutation(() =>
          transactionAdapter.transitionSaleLineFulfillment(current.id, liveLine.id, {
            expectedVersion: current.version,
            status: 'COMPLETED',
          }),
        );
      }
      const updated = await command.runMutation(() =>
        transactionAdapter.finalizeSale(
          current.id,
          current.version,
          `cashier-finalize-${crypto.randomUUID()}`,
        ),
      );
      command.commitSale(updated);
      if (queueContextSale?.id === updated.id) setQueueContextSale(updated);
      return updated;
    } catch (error) {
      command.reportError(error);
      throw error;
    }
  };

  const createQueuedPayment = async (
    targetSale: Sale,
    method: PaymentMethod,
    appliedAmount: string,
    tenderedAmount?: string,
    providerReference?: string,
    paymentRouteId?: string,
  ) => {
    command.clearNotice();
    try {
      const authoritative = await transactionAdapter.getSale(targetSale.id);
      if (authoritative.payments.some((payment) => payment.status === 'PENDING'))
        throw new Error(
          copy('A payment is still pending. Wait for it to settle before trying again.'),
        );
      const updated = await command.runMutation(() =>
        transactionAdapter.createSalePayment(
          authoritative.id,
          {
            expectedVersion: authoritative.version,
            method,
            ...(paymentRouteId ? { paymentRouteId } : {}),
            appliedAmount,
            ...(tenderedAmount ? { tenderedAmount } : {}),
            ...(providerReference ? { providerReference } : {}),
          },
          `cashier-payment-${crypto.randomUUID()}`,
        ),
      );
      cacheQueueContext(updated);
      return updated;
    } catch (error) {
      command.reportError(error);
      throw error;
    }
  };

  const transitionQueuedPayment = async (
    targetSale: Sale,
    payment: Payment,
    status: Exclude<PaymentStatus, 'PENDING'>,
  ) => {
    command.clearNotice();
    try {
      const authoritative = await transactionAdapter.getSale(targetSale.id);
      const livePayment = authoritative.payments.find((candidate) => candidate.id === payment.id);
      if (!livePayment || livePayment.status !== 'PENDING')
        throw new Error(copy('The pending payment is no longer available.'));
      const updated = await command.runMutation(() =>
        transactionAdapter.transitionSalePayment(authoritative.id, livePayment.id, {
          expectedVersion: authoritative.version,
          status,
        }),
      );
      cacheQueueContext(updated);
      return updated;
    } catch (error) {
      command.reportError(error);
      throw error;
    }
  };

  const createPayment = (
    method: PaymentMethod,
    appliedAmount: string,
    tenderedAmount?: string,
    providerReference?: string,
    paymentRouteId?: string,
  ) => core.createPayment(method, appliedAmount, tenderedAmount, providerReference, paymentRouteId);

  const voidQueuedSale = async (targetSale: Sale) => {
    command.clearNotice();
    try {
      const authoritative = await transactionAdapter.getSale(targetSale.id);
      const updated = await command.runMutation(() =>
        transactionAdapter.voidSale(
          authoritative.id,
          authoritative.version,
          `cashier-void-${crypto.randomUUID()}`,
        ),
      );
      cacheQueueContext(updated);
      return updated;
    } catch (error) {
      command.reportError(error);
      throw error;
    }
  };

  const contextViewModel = queueContextSale
    ? createSaleWorkspaceViewModel(queueContextSale, effectiveConnectivity, 'CLEAN', runtime.locale)
    : saleWorkspace.viewModel;

  return {
    locale: runtime.locale,
    currency: runtime.currency,
    items: catalog.items,
    categories: catalog.categories,
    employees: employeeOptions.employees,
    paymentRoutes: (paymentRoutesQuery.data?.items ?? []).filter(
      (route) => route.status === 'ACTIVE',
    ),
    refreshPaymentRoutes,
    refreshPromotionEligibility,
    selectedLocationId: selectedLocationId ?? '',
    search: catalog.search,
    itemType: catalog.itemType,
    notice:
      command.notice ??
      (saleWorkspace.saleQueryError
        ? cashierTransactionErrorMessage(saleWorkspace.saleQueryError, runtime.locale)
        : catalog.error
          ? cashierTransactionErrorMessage(catalog.error, runtime.locale)
          : null),
    variantPicker,
    lineTask,
    contributionPreview: contributionPreviewQuery.data ?? null,
    isContributionPreviewLoading: contributionPreviewQuery.isLoading,
    isCompletionOpen,
    viewModel: contextViewModel,
    isLoadingCatalog: catalog.isLoading,
    isLoadingEmployees: employeeOptions.isLoading,
    isLoadingPaymentRoutes: paymentRoutesQuery.isLoading,
    isLoadingSale: saleWorkspace.isLoading,
    isCoreMutating: core.isPending || command.isMutating,
    canRetryLastCommand: core.canRetryLastCoreCommand || saleWorkspace.canRetryLastAdd,
    setSearch: catalog.setSearch,
    setItemType: catalog.setItemType,
    selectItem,
    selectVariant,
    cachedCardDisplayPrice,
    cachedCardPrice,
    requestEmployeeOptions: () => setEmployeeOptionsEnabled(true),
    closeVariantPicker: () => setVariantPicker(null),
    changeQuantity,
    removeLine,
    changeDraftQuantity: saleWorkspace.changeDraftQuantity,
    removeDraftLine: saleWorkspace.removeDraftLine,
    commitDraft: saleWorkspace.commitDraft,
    customer: saleWorkspace.customer,
    isCustomerPending: saleWorkspace.isCustomerPending,
    changeCustomer: saleWorkspace.changeCustomer,
    cart: saleWorkspace.cart,
    openLineTask,
    closeLineTask: () => setLineTaskId(null),
    setPriceOverride: core.setPriceOverride,
    clearPriceOverride: core.clearPriceOverride,
    setLineDiscount: core.setLineDiscount,
    clearLineDiscount: core.clearLineDiscount,
    setAssignments,
    setContributions,
    transitionFulfillment: core.transitionFulfillment,
    startQueuedFulfillment,
    queueSale,
    startSaleWork,
    transitionQueuedFulfillment,
    setQueuedWorkUnits,
    finalizeQueuedSale,
    createQueuedPayment,
    transitionQueuedPayment,
    openCompletion: () => setCompletionOpen(true),
    closeCompletion: () => setCompletionOpen(false),
    setOrderDiscount: core.setOrderDiscount,
    clearOrderDiscount: core.clearOrderDiscount,
    createPayment,
    transitionPayment: core.transitionPayment,
    finalizeSale: core.finalizeSale,
    voidSale: core.voidSale,
    voidQueuedSale,
    newSale,
    clearProcessedDraft,
    openQueueContext,
    closeQueueContext,
    hydrateQueuedSale,
    hydrateQueuedPayment,
    acknowledgeLatestState: command.acknowledgeLatestState,
    retryLastCommand,
  };
}
