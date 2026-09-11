import { useConnectivity, useRuntime } from '@digvation/pos-runtime';
import { useAuth } from '@digvation/pos-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { useCashierSession } from '../../app/providers/cashier-session-provider';
import { cashierTransactionErrorMessage } from './cashier-transaction-errors';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import { fetchResolvedPrice, fetchResolvedVariantPrices } from './resolved-price-query';
import type {
  CatalogItem,
  CatalogVariant,
  PaymentMethod,
  Sale,
  SaleLine,
} from './cashier-transaction.types';
import {
  createCashierTransactionAdapter,
  isLocalCashierDemoEnabled,
} from './cashier-transaction-adapter-factory';
import type { VariantPickerContext, VariantPickerState } from './components/variant-picker';
import { useEmployeeOptions } from './use-employee-options';
import { createSaleWorkspaceViewModel } from './sale-workspace-view-model';
import { useSaleCommandCoordinator } from './use-sale-command-coordinator';
import { useSaleCoreController } from './use-sale-core-controller';
import { useSaleWorkspaceController } from './use-sale-workspace-controller';
import { useSellingCatalog } from './use-selling-catalog';

export function useCashierTransactionWorkspace(routeSaleId?: string) {
  const runtime = useRuntime();
  const { authPort } = useAuth();
  const queryClient = useQueryClient();
  const connectivity = useConnectivity();
  const navigate = useNavigate();
  const { selectedLocationId, selectLocation, rememberSale } = useCashierSession();
  const [variantPicker, setVariantPicker] = useState<VariantPickerState | null>(null);
  const [lineTaskId, setLineTaskId] = useState<string | null>(null);
  const [isCompletionOpen, setCompletionOpen] = useState(false);
  const [resumedSaleId, setResumedSaleId] = useState<string | null>(null);
  const [areEmployeeOptionsEnabled, setEmployeeOptionsEnabled] = useState(false);
  const transactionAdapter = useMemo(
    () => createCashierTransactionAdapter(runtime, authPort.getAccessToken.bind(authPort)),
    [authPort, runtime],
  );
  const effectiveConnectivity = isLocalCashierDemoEnabled() ? 'ONLINE' : connectivity.state;

  const command = useSaleCommandCoordinator({ client: transactionAdapter, rememberSale });

  const catalog = useSellingCatalog({
    query: transactionAdapter,
    locale: runtime.locale,
    sellingLocationId: selectedLocationId ?? '',
    currency: runtime.currency,
  });

  const employeeOptions = useEmployeeOptions(transactionAdapter, areEmployeeOptionsEnabled);

  const activeSaleId = routeSaleId ?? resumedSaleId ?? undefined;
  const saleWorkspace = useSaleWorkspaceController({
    client: transactionAdapter,
    command,
    ...(activeSaleId === undefined ? {} : { routeSaleId: activeSaleId }),
    selectedLocationId,
    currency: runtime.currency,
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
  });

  const addCatalogItem = async (
    item: CatalogItem,
    catalogVariantId: string | undefined,
    context: VariantPickerContext,
    targetSaleId?: string,
    catalogVariant: CatalogVariant | null = null,
  ) => {
    if (context === 'CART' && resumedSaleId) {
      throw new Error('Selesaikan penyesuaian transaksi sebelum menambahkan item ke cart.');
    }
    if (context === 'TRANSACTION_ADJUSTMENT' && (!targetSaleId || resumedSaleId !== targetSaleId)) {
      throw new Error(
        'Transaksi yang akan disesuaikan tidak lagi aktif. Buka kembali penyesuaian.',
      );
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
        context === 'TRANSACTION_ADJUSTMENT' ? (resumedSaleId ?? undefined) : undefined;
      if (context === 'TRANSACTION_ADJUSTMENT' && !targetSaleId) {
        throw new Error(
          'Transaksi yang akan disesuaikan tidak lagi aktif. Buka kembali penyesuaian.',
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
        setVariantPicker({
          item,
          variants,
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
        'Start a new Sale? The current Sale remains OPEN until it is finalized or voided.',
      );
      if (!confirmed) return;
    }
    navigate('/sell');
    setResumedSaleId(null);
    setCompletionOpen(false);
    setLineTaskId(null);
    command.clearAttention();
    saleWorkspace.clearDraft();
  };

  const clearProcessedDraft = () => {
    navigate('/sell');
    setResumedSaleId(null);
    setCompletionOpen(false);
    setLineTaskId(null);
    command.clearAttention();
    saleWorkspace.clearDraft();
  };

  const resumeSale = (saleId: string) => {
    setResumedSaleId(saleId);
    setCompletionOpen(false);
    setLineTaskId(null);
    command.clearAttention();
  };

  const hydrateQueuedSale = async (saleId: string) => {
    setCompletionOpen(false);
    setLineTaskId(null);
    command.clearAttention();
    const hydrated = await command.refetchSale(saleId);
    if (!hydrated) throw new Error('The latest Sale could not be loaded.');
    setResumedSaleId(saleId);
    return hydrated;
  };

  const hydrateQueuedPayment = async (saleId: string) => {
    const hydrated = await hydrateQueuedSale(saleId);
    const readiness = createSaleWorkspaceViewModel(hydrated, effectiveConnectivity, 'CLEAN');
    if (readiness.paymentMutation.state !== 'AVAILABLE') {
      throw new Error('The latest Sale is not ready to accept another payment.');
    }
    return { sale: hydrated, availableToPay: readiness.availableToPay };
  };

  const cachedCardPrice = (itemId: string): string | null => {
    const item = catalog.items.find((candidate) => candidate.id === itemId);
    return item?.displayPrice?.kind === 'EXACT' ? item.displayPrice.amount : null;
  };

  const retryLastCommand = () => {
    if (core.canRetryLastCoreCommand) core.retryLastCoreCommand();
    else saleWorkspace.retryLastAdd();
  };

  const openLineTask = (line: SaleLine) => {
    setEmployeeOptionsEnabled(true);
    setLineTaskId(line.id);
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
      return updated;
    } catch (error) {
      command.reportError(error);
      throw error;
    }
  };

  const startQueuedFulfillment = async (sale: Sale, preferredLine: SaleLine) => {
    command.clearNotice();
    try {
      let current = sale;
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
        throw new Error('No queued work remains to start.');
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
      return current;
    } catch (error) {
      command.reportError(error);
      throw error;
    }
  };

  const setQueuedAssignments = async (
    sale: Sale,
    line: SaleLine,
    employeeIds: string[],
    contributors: Array<{ employeeId: string; shareRate?: string }>,
  ) => {
    command.clearNotice();
    try {
      let updated = await command.runMutation(() =>
        transactionAdapter.setSaleLineAssignments(sale.id, line.id, {
          expectedVersion: sale.version,
          employeeIds,
        }),
      );
      if (line.allowEmployeeContributionSnapshot) {
        updated = await command.runMutation(() =>
          transactionAdapter.setSaleLineContributions(sale.id, line.id, {
            expectedVersion: updated.version,
            contributors,
          }),
        );
      }
      command.commitSale(updated);
      return updated;
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
        throw new Error('Mulai semua pekerjaan sebelum menyelesaikan transaksi.');
      }
      if (
        trackedLines.some(
          (line) => !line.fulfillment || line.fulfillment.status === 'CANCELED',
        )
      ) {
        throw new Error('Pekerjaan yang dibatalkan tidak dapat diselesaikan sebagai transaksi aktif.');
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
  ) => {
    command.clearNotice();
    try {
      const updated = await command.runMutation(() =>
        transactionAdapter.createSalePayment(
          targetSale.id,
          {
            expectedVersion: targetSale.version,
            method,
            appliedAmount,
            ...(tenderedAmount ? { tenderedAmount } : {}),
            ...(providerReference ? { providerReference } : {}),
          },
          `cashier-payment-${crypto.randomUUID()}`,
        ),
      );
      command.commitSale(updated);
      return updated;
    } catch (error) {
      command.reportError(error);
      throw error;
    }
  };

  const createPayment = async (
    method: PaymentMethod,
    appliedAmount: string,
    tenderedAmount?: string,
    providerReference?: string,
  ) => {
    if (resumedSaleId) {
      const targetSale = queryClient.getQueryData<Sale>(cashierTransactionKeys.sale(resumedSaleId));
      if (targetSale) {
        return createQueuedPayment(
          targetSale,
          method,
          appliedAmount,
          tenderedAmount,
          providerReference,
        );
      }
    }
    return core.createPayment(method, appliedAmount, tenderedAmount, providerReference);
  };

  return {
    locale: runtime.locale,
    currency: runtime.currency,
    items: catalog.items,
    categories: catalog.categories,
    employees: employeeOptions.employees,
    selectedLocationId: selectedLocationId ?? '',
    search: catalog.search,
    itemType: catalog.itemType,
    notice:
      command.notice ??
      (saleWorkspace.saleQueryError
        ? cashierTransactionErrorMessage(saleWorkspace.saleQueryError)
        : catalog.error
          ? cashierTransactionErrorMessage(catalog.error)
          : null),
    variantPicker,
    lineTask,
    contributionPreview: contributionPreviewQuery.data ?? null,
    isContributionPreviewLoading: contributionPreviewQuery.isLoading,
    isCompletionOpen,
    viewModel: saleWorkspace.viewModel,
    isLoadingCatalog: catalog.isLoading,
    isLoadingEmployees: employeeOptions.isLoading,
    isLoadingSale: saleWorkspace.isLoading,
    isCoreMutating: core.isPending || command.isMutating,
    canRetryLastCommand: core.canRetryLastCoreCommand || saleWorkspace.canRetryLastAdd,
    setSearch: catalog.setSearch,
    setItemType: catalog.setItemType,
    selectItem,
    selectVariant,
    cachedCardPrice,
    requestEmployeeOptions: () => setEmployeeOptionsEnabled(true),
    closeVariantPicker: () => setVariantPicker(null),
    changeQuantity: saleWorkspace.changeQuantity,
    removeLine: saleWorkspace.removeLine,
    changeDraftQuantity: saleWorkspace.changeDraftQuantity,
    removeDraftLine: saleWorkspace.removeDraftLine,
    commitDraft: saleWorkspace.commitDraft,
    cart: saleWorkspace.cart,
    openLineTask,
    closeLineTask: () => setLineTaskId(null),
    setPriceOverride: core.setPriceOverride,
    clearPriceOverride: core.clearPriceOverride,
    setLineDiscount: core.setLineDiscount,
    clearLineDiscount: core.clearLineDiscount,
    setAssignments: core.setAssignments,
    setContributions: core.setContributions,
    transitionFulfillment: core.transitionFulfillment,
    startQueuedFulfillment,
    transitionQueuedFulfillment,
    setQueuedAssignments,
    finalizeQueuedSale,
    createQueuedPayment,
    openCompletion: () => setCompletionOpen(true),
    closeCompletion: () => setCompletionOpen(false),
    setOrderDiscount: core.setOrderDiscount,
    clearOrderDiscount: core.clearOrderDiscount,
    createPayment,
    transitionPayment: core.transitionPayment,
    finalizeSale: core.finalizeSale,
    voidSale: core.voidSale,
    newSale,
    clearProcessedDraft,
    resumeSale,
    hydrateQueuedSale,
    hydrateQueuedPayment,
    acknowledgeLatestState: command.acknowledgeLatestState,
    retryLastCommand,
  };
}
