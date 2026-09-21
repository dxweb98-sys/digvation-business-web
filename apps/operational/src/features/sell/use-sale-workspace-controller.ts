import { createDecimal } from '@digvation/pos-money';
import type { ConnectivityState } from '@digvation/pos-runtime';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { transactionQueryPolicy } from '../../app/data/operational-cache-policy';
import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../app/localization/operational-localization';
import type { SaleTransactionClient } from './cashier-transaction.adapter';
import {
  addCartDraftSelection,
  cartDraftDisplayLines,
  cartDraftEstimatedTotal,
  cartDraftStartInput,
  draftCustomerSnapshot,
  emptyCartDraft,
  removeCartDraftLine,
  saleDisplayLines,
  setCartDraftCustomer,
  setCartDraftQuantity,
  type CartDraft,
} from './cart-draft';
import { isKnownApiFailure } from './cashier-transaction-errors';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import type {
  CatalogItem,
  CatalogVariant,
  ResolvedPrice,
  Sale,
  SaleCustomer,
  SaleCustomerSelection,
  SaleLine,
} from './cashier-transaction.types';
import { createSaleWorkspaceViewModel } from './sale-workspace-view-model';
import { createDraftCommitGate } from './draft-commit-gate';
import type { SaleCommandCoordinator } from './use-sale-command-coordinator';

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,14})(\.\d{1,4})?$/;

interface AddItemIntent {
  catalogItemId: string;
  catalogVariantId?: string;
  quantity: string;
  addIdempotencyKey: string;
  saleId: string;
  expectedVersion: number;
}

interface AddItemConfiguration {
  catalogItem: CatalogItem;
  catalogVariant: CatalogVariant | null;
  resolvedPrice: ResolvedPrice;
}

interface CommitDraftIntent {
  draft: CartDraft;
  idempotencyKey: string;
}

interface UseSaleWorkspaceControllerOptions {
  client: SaleTransactionClient;
  command: SaleCommandCoordinator;
  routeSaleId?: string;
  selectedLocationId: string | null;
  currency: string;
  locale: string;
  connectivity: ConnectivityState;
  selectLocation: (locationId: string | null) => void;
  rememberSale: (saleId: string) => void;
}

function createIdempotencyKey(operation: string): string {
  return `cashier-${operation}-${crypto.randomUUID()}`;
}

function isPositiveQuantity(value: string): boolean {
  if (!QUANTITY_PATTERN.test(value)) return false;
  const [whole, fraction = ''] = value.split('.');
  return whole !== '0' || /[1-9]/.test(fraction);
}

function isCompatibleLine(
  line: SaleLine,
  catalogVariantId: string | undefined,
  configuration: AddItemConfiguration,
): boolean {
  const service = configuration.catalogItem.serviceDefinition;
  return (
    line.removedAt === null &&
    line.catalogItemId === configuration.catalogItem.id &&
    line.catalogVariantId === (catalogVariantId ?? null) &&
    line.catalogPriceId === configuration.resolvedPrice.catalogPriceId &&
    line.resolvedUnitPrice === configuration.resolvedPrice.amount &&
    line.effectiveUnitPrice === configuration.resolvedPrice.amount &&
    line.overrideAmount === null &&
    line.overrideReason === null &&
    line.discountType === null &&
    line.discountValue === null &&
    line.discountReason === null &&
    line.fulfillmentBehaviorSnapshot === configuration.catalogItem.fulfillmentBehavior &&
    line.employeeAssignmentModeSnapshot === (service?.employeeAssignmentMode ?? null) &&
    line.allowEmployeeContributionSnapshot === (service?.allowEmployeeContribution ?? false) &&
    line.defaultDurationMinutesSnapshot === (service?.defaultDurationMinutes ?? null) &&
    (line.fulfillment === null || line.fulfillment.status === 'WAITING') &&
    !line.participations.some((participation) => participation.assigned) &&
    line.contributions.length === 0
  );
}

export function useSaleWorkspaceController({
  client,
  command,
  routeSaleId,
  selectedLocationId,
  currency,
  locale,
  connectivity,
  selectLocation,
  rememberSale,
}: UseSaleWorkspaceControllerOptions) {
  const navigate = useNavigate();
  const operationalLocale = resolveOperationalLocale(locale);
  const copy = (value: string) => operationalCopy(value, operationalLocale);
  const [retryIntent, setRetryIntent] = useState<AddItemIntent | null>(null);
  const [draft, setDraft] = useState<CartDraft | null>(null);
  const [retryCommitIntent, setRetryCommitIntent] = useState<CommitDraftIntent | null>(null);
  const previousLocationIdRef = useRef(selectedLocationId);
  const draftCommitGateRef = useRef(createDraftCommitGate<Sale>());

  const saleQuery = useQuery({
    queryKey: cashierTransactionKeys.sale(routeSaleId ?? 'idle'),
    queryFn: ({ signal }) => client.getSale(routeSaleId!, signal),
    enabled: Boolean(routeSaleId),
    ...transactionQueryPolicy,
  });

  useEffect(() => {
    const sale = saleQuery.data;
    if (!sale) return;
    rememberSale(sale.id);
    if (selectedLocationId !== sale.sellingLocationId) selectLocation(sale.sellingLocationId);
  }, [rememberSale, saleQuery.data, selectLocation, selectedLocationId]);

  useEffect(() => {
    if (previousLocationIdRef.current !== selectedLocationId) {
      previousLocationIdRef.current = selectedLocationId;
      setDraft(null);
      setRetryCommitIntent(null);
    }
  }, [selectedLocationId]);

  const addItemMutation = useMutation({
    mutationFn: (intent: AddItemIntent) =>
      command.runMutation(async () => {
        if (connectivity === 'OFFLINE')
          throw new Error(copy('Reconnect before changing this transaction.'));

        return client.addSaleLine(
          intent.saleId,
          {
            expectedVersion: intent.expectedVersion,
            catalogItemId: intent.catalogItemId,
            ...(intent.catalogVariantId ? { catalogVariantId: intent.catalogVariantId } : {}),
            quantity: intent.quantity,
          },
          intent.addIdempotencyKey,
        );
      }),
    onSuccess: (sale) => {
      command.commitSale(sale);
      setRetryIntent(null);
    },
    onError: async (error, intent) => {
      if (isKnownApiFailure(error)) setRetryIntent(null);
      await command.recoverFailure(error, intent.saleId);
    },
  });

  const commitDraftMutation = useMutation({
    mutationFn: (intent: CommitDraftIntent) =>
      command.runMutation(async () => {
        if (connectivity === 'OFFLINE')
          throw new Error(copy('Reconnect before starting a transaction.'));
        return client.startSale(cartDraftStartInput(intent.draft), intent.idempotencyKey);
      }),
    onSuccess: (sale) => {
      command.commitSale(sale);
      selectLocation(sale.sellingLocationId);
      setDraft(null);
      setRetryCommitIntent(null);
      navigate(`/sell/${sale.id}`, { replace: true });
    },
    onError: async (error) => {
      if (isKnownApiFailure(error)) setRetryCommitIntent(null);
      await command.recoverFailure(error);
    },
  });

  const commitPreparedDraft = (prepared: CartDraft): Promise<Sale> => {
    const intent: CommitDraftIntent = {
      draft: prepared,
      idempotencyKey: createIdempotencyKey('start-sale'),
    };
    setDraft(prepared);
    setRetryCommitIntent(intent);
    return draftCommitGateRef.current.run(() => commitDraftMutation.mutateAsync(intent));
  };

  const customerMutation = useMutation({
    mutationFn: (intent: {
      saleId: string;
      expectedVersion: number;
      customer: SaleCustomerSelection;
    }) =>
      command.runMutation(async () => {
        if (connectivity === 'OFFLINE')
          throw new Error(copy('Reconnect before changing this transaction.'));
        return client.setSaleCustomer(
          intent.saleId,
          { expectedVersion: intent.expectedVersion, customer: intent.customer },
          createIdempotencyKey('sale-customer'),
        );
      }),
    onSuccess: command.commitSale,
    onError: async (error, intent) => command.recoverFailure(error, intent.saleId),
  });

  const loyaltyRedemptionMutation = useMutation({
    mutationFn: (intent: { saleId: string; expectedVersion: number; points: string }) =>
      command.runMutation(() =>
        client.applyLoyaltyRedemption(
          intent.saleId,
          { expectedVersion: intent.expectedVersion, points: intent.points },
          createIdempotencyKey('loyalty-redemption'),
        ),
      ),
    onSuccess: command.commitSale,
    onError: async (error, intent) => command.recoverFailure(error, intent.saleId),
  });
  const removeLoyaltyRedemptionMutation = useMutation({
    mutationFn: (intent: { saleId: string; expectedVersion: number }) =>
      command.runMutation(() =>
        client.removeLoyaltyRedemption(
          intent.saleId,
          intent.expectedVersion,
          createIdempotencyKey('loyalty-redemption-remove'),
        ),
      ),
    onSuccess: command.commitSale,
    onError: async (error, intent) => command.recoverFailure(error, intent.saleId),
  });
  const quantityMutation = useMutation({
    mutationFn: (intent: {
      saleId: string;
      saleLineId: string;
      expectedVersion: number;
      quantity: string;
    }) =>
      command.runMutation(async () => {
        if (connectivity === 'OFFLINE')
          throw new Error(copy('Reconnect before changing this transaction.'));
        return client.setSaleLineQuantity(intent.saleId, intent.saleLineId, {
          expectedVersion: intent.expectedVersion,
          quantity: intent.quantity,
        });
      }),
    onSuccess: command.commitSale,
    onError: async (error, intent) => command.recoverFailure(error, intent.saleId),
  });

  const removeMutation = useMutation({
    mutationFn: (intent: { saleId: string; saleLineId: string; expectedVersion: number }) =>
      command.runMutation(async () => {
        if (connectivity === 'OFFLINE')
          throw new Error(copy('Reconnect before changing this transaction.'));
        return client.removeSaleLine(intent.saleId, intent.saleLineId, intent.expectedVersion);
      }),
    onSuccess: command.commitSale,
    onError: async (error, intent) => command.recoverFailure(error, intent.saleId),
  });

  const viewModel = createSaleWorkspaceViewModel(
    saleQuery.data ?? null,
    connectivity,
    command.effectiveSynchronization,
    locale,
  );

  const addItem = (
    catalogItemId: string,
    catalogVariantId?: string,
    configuration?: AddItemConfiguration,
  ) => {
    if (!selectedLocationId) {
      command.reportError(new Error(copy('Select a branch before starting a transaction.')));
      return;
    }
    if (viewModel.monetaryMutation.state !== 'AVAILABLE') return;

    const currentSale = saleQuery.data;
    if (!currentSale) {
      if (!configuration) {
        command.reportError(new Error(copy('Resolve the selected price before adding this item.')));
        return;
      }
      if (commitDraftMutation.isPending) return;
      const prepared = addCartDraftSelection(
        draft ?? emptyCartDraft(selectedLocationId, currency),
        configuration.catalogItem,
        configuration.catalogVariant,
        configuration.resolvedPrice,
      );
      setRetryCommitIntent(null);
      if (prepared.customer) {
        void commitPreparedDraft(prepared).catch(() => undefined);
      } else {
        setDraft(prepared);
      }
      return;
    }
    const compatibleLine = configuration
      ? currentSale.lines.find((line) => isCompatibleLine(line, catalogVariantId, configuration))
      : undefined;
    if (compatibleLine) {
      changeQuantity(compatibleLine, createDecimal(compatibleLine.quantity).plus('1').toFixed(4));
      return;
    }
    const intent: AddItemIntent = {
      catalogItemId,
      ...(catalogVariantId ? { catalogVariantId } : {}),
      quantity: '1',
      addIdempotencyKey: createIdempotencyKey('add-line'),
      saleId: currentSale.id,
      expectedVersion: currentSale.version,
    };

    setRetryIntent(intent);
    addItemMutation.mutate(intent);
  };

  const changeQuantity = (line: SaleLine, quantity: string) => {
    const sale = saleQuery.data;
    if (!sale || viewModel.monetaryMutation.state !== 'AVAILABLE') return;
    if (!isPositiveQuantity(quantity)) {
      command.reportError(
        new Error(copy('Quantity must be greater than zero with up to four decimal places.')),
      );
      return;
    }
    quantityMutation.mutate({
      saleId: sale.id,
      saleLineId: line.id,
      expectedVersion: sale.version,
      quantity,
    });
  };

  const removeLine = (line: SaleLine) => {
    const sale = saleQuery.data;
    if (!sale || viewModel.monetaryMutation.state !== 'AVAILABLE') return;
    removeMutation.mutate({ saleId: sale.id, saleLineId: line.id, expectedVersion: sale.version });
  };

  /**
   * Identity of the transaction being served: the Sale owns it once the Sale
   * exists, and the local draft holds it only until then.
   */
  const activeCustomer: SaleCustomer | null =
    saleQuery.data?.customer ?? draftCustomerSnapshot(draft?.customer ?? null);

  const changeCustomer = async (selection: SaleCustomerSelection) => {
    const sale = saleQuery.data;
    if (!sale) {
      const prepared = setCartDraftCustomer(
        draft ?? emptyCartDraft(selectedLocationId ?? '', currency),
        selection,
      );
      setDraft(prepared);
      setRetryCommitIntent(null);
      if (prepared.lines.length) await commitPreparedDraft(prepared);
      return;
    }
    await customerMutation.mutateAsync({
      saleId: sale.id,
      expectedVersion: sale.version,
      customer: selection,
    });
  };

  const commitDraft = async () => {
    if (!draft?.lines.length) throw new Error(copy('Add at least one item before payment.'));
    const intent =
      retryCommitIntent?.draft === draft
        ? retryCommitIntent
        : { draft, idempotencyKey: createIdempotencyKey('start-sale') };
    setRetryCommitIntent(intent);
    return draftCommitGateRef.current.run(() => commitDraftMutation.mutateAsync(intent));
  };

  const applyLoyaltyRedemption = (points: string) => {
    const sale = saleQuery.data;
    if (!sale || sale.customer?.type !== 'MEMBER' || !points.trim()) return;
    loyaltyRedemptionMutation.mutate({ saleId: sale.id, expectedVersion: sale.version, points });
  };
  const removeLoyaltyRedemption = () => {
    const sale = saleQuery.data;
    if (!sale?.loyaltyRedemption) return;
    removeLoyaltyRedemptionMutation.mutate({ saleId: sale.id, expectedVersion: sale.version });
  };
  const activeSaleLines = viewModel.activeLines;
  const draftLines = cartDraftDisplayLines(draft);
  const cartLines = saleQuery.data
    ? saleDisplayLines(activeSaleLines, saleQuery.data.adjustments ?? [])
    : draftLines;
  const cartTotal = saleQuery.data?.totalAmount ?? cartDraftEstimatedTotal(draft);

  return {
    sale: saleQuery.data ?? null,
    viewModel,
    customer: activeCustomer,
    isCustomerPending: customerMutation.isPending,
    isDraftCommitPending: commitDraftMutation.isPending,
    changeCustomer,
    isLoading: Boolean(routeSaleId) && saleQuery.isLoading,
    isLoyaltyRedemptionPending:
      loyaltyRedemptionMutation.isPending || removeLoyaltyRedemptionMutation.isPending,
    applyLoyaltyRedemption,
    removeLoyaltyRedemption,
    cart: {
      lines: cartLines,
      grossAmount: saleQuery.data?.grossAmount ?? cartTotal,
      taxAmount: saleQuery.data?.taxAmount ?? '0.0000',
      totalAmount: cartTotal,
      discountAmount: saleQuery.data?.discountAmount ?? '0.0000',
      isLocalDraft: !saleQuery.data && draftLines.length > 0,
    },
    canRetryLastAdd:
      (Boolean(retryIntent) && !addItemMutation.isPending) ||
      (Boolean(retryCommitIntent) && !commitDraftMutation.isPending),
    addItem,
    changeQuantity,
    removeLine,
    changeDraftQuantity: (lineId: string, quantity: string) => {
      try {
        setRetryCommitIntent(null);
        setDraft((current) =>
          current ? setCartDraftQuantity(current, lineId, quantity) : current,
        );
      } catch (error) {
        command.reportError(error);
      }
    },
    removeDraftLine: (lineId: string) => {
      setRetryCommitIntent(null);
      setDraft((current) => (current ? removeCartDraftLine(current, lineId) : current));
    },
    commitDraft,
    clearDraft: () => {
      setDraft(null);
      setRetryCommitIntent(null);
    },
    retryLastAdd: () => {
      command.clearNotice();
      if (retryCommitIntent && !commitDraftMutation.isPending) {
        commitDraftMutation.mutate(retryCommitIntent);
      } else if (retryIntent && !addItemMutation.isPending) {
        addItemMutation.mutate(retryIntent);
      }
    },
    saleQueryError: saleQuery.error,
  };
}
