import { createDecimal } from '@digvation/pos-money';
import type { ConnectivityState } from '@digvation/pos-runtime';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { transactionQueryPolicy } from '../../../../app/data/operational-cache-policy';
import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../../../app/localization/operational-localization';
import type {
  ReplaceSaleLineInput,
  SaleTransactionClient,
} from '../../transaction/api/cashier-transaction.adapter';
import {
  addCartDraftSelection,
  groupUnitAdditions,
  replacementLinesOf,
  cartDraftDisplayLines,
  cartDraftEstimatedTotal,
  cartDraftStartInput,
  draftCustomerSnapshot,
  emptyCartDraft,
  removeCartDraftLine,
  replaceCartDraftLine,
  saleDisplayLines,
  setCartDraftCustomer,
  setCartDraftQuantity,
  startAddition,
  type CartDraft,
  type CartDraftAdditionalItem,
  type CartDraftSalesperson,
  cartDraftPricingInput,
} from '../../cart/cart-draft';
import { isKnownApiFailure } from '../../transaction/api/cashier-transaction-errors';
import { cashierTransactionKeys } from '../../transaction/api/cashier-transaction-keys';
import type {
  CatalogItem,
  CatalogVariant,
  ResolvedPrice,
  Sale,
  SaleCustomer,
  SaleCustomerSelection,
  SaleLine,
} from '../../transaction/model/cashier-transaction.types';
import { createSaleWorkspaceViewModel } from './sale-workspace-view-model';
import { createDraftCommitGate } from './draft-commit-gate';
import type { SaleCommandCoordinator } from './use-sale-command-coordinator';

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,14})(\.\d{1,4})?$/;

interface AddItemIntent {
  catalogItemId: string;
  catalogVariantId?: string;
  quantity: string;
  additionalComponents?: readonly CartDraftAdditionalItem[];
  /** Units with different additions: each distinct configuration becomes its own Sale line. */
  unitAdditions?: readonly (readonly CartDraftAdditionalItem[])[];
  soldByEmployeeId?: string;
  addIdempotencyKey: string;
  saleId: string;
  expectedVersion: number;
}

export interface AddItemConfiguration {
  catalogItem: CatalogItem;
  catalogVariant: CatalogVariant | null;
  resolvedPrice: ResolvedPrice;
  /** Initial primary quantity chosen in the Item Configurator; defaults to one. */
  quantity?: string;
  additionalComponents?: readonly CartDraftAdditionalItem[];
  unitAdditions?: readonly (readonly CartDraftAdditionalItem[])[];
  /** Product only, optional. Part of line identity: a different salesperson never merges. */
  soldBy?: CartDraftSalesperson | null;
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

export function isCompatibleLine(
  line: SaleLine,
  catalogVariantId: string | undefined,
  configuration: AddItemConfiguration,
): boolean {
  const service = configuration.catalogItem.serviceDefinition;
  // A line with operator-chosen additional items describes its own composition; never merge.
  if (
    configuration.additionalComponents?.length ||
    line.compositionComponents?.some((component) => component.componentSource === 'SALE_SELECTED')
  )
    return false;
  return (
    line.removedAt === null &&
    line.catalogItemId === configuration.catalogItem.id &&
    line.catalogVariantId === (catalogVariantId ?? null) &&
    (line.soldByEmployeeId ?? null) === (configuration.soldBy?.employeeId ?? null) &&
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
  // The Sale just created from the draft, until the route delivers it. The committed draft stays on
  // screen across that gap and is cleared in the same render the Sale replaces it, so the cart is
  // never empty in between.
  const [handoverSale, setHandoverSale] = useState<Sale | null>(null);
  const previousLocationIdRef = useRef(selectedLocationId);
  const draftCommitGateRef = useRef(createDraftCommitGate<Sale>());

  const saleQuery = useQuery({
    queryKey: cashierTransactionKeys.sale(routeSaleId ?? 'idle'),
    queryFn: ({ signal }) => client.getSale(routeSaleId!, signal),
    enabled: Boolean(routeSaleId),
    ...transactionQueryPolicy,
  });

  if (handoverSale && saleQuery.data?.id === handoverSale.id) {
    setHandoverSale(null);
    setDraft(null);
  }

  useEffect(() => {
    const sale = saleQuery.data;
    if (!sale) return;
    rememberSale(sale.id);
    if (selectedLocationId !== sale.sellingLocationId) selectLocation(sale.sellingLocationId);
  }, [rememberSale, saleQuery.data, selectLocation, selectedLocationId]);

  useEffect(() => {
    if (previousLocationIdRef.current !== selectedLocationId) {
      previousLocationIdRef.current = selectedLocationId;
      setHandoverSale(null);
      setDraft(null);
      setRetryCommitIntent(null);
    }
  }, [selectedLocationId]);

  const addItemMutation = useMutation({
    mutationFn: (intent: AddItemIntent) =>
      command.runMutation(async () => {
        if (connectivity === 'OFFLINE')
          throw new Error(copy('Reconnect before changing this transaction.'));

        // Different unit configurations are separate lines (one line = one unambiguous unit price);
        // identical units share one line. Each call continues from the version the last one returned.
        const groups = intent.unitAdditions
          ? groupUnitAdditions(intent.unitAdditions).map((group) => ({
              quantity: String(group.quantity),
              additions: group.additionalComponents,
            }))
          : [{ quantity: intent.quantity, additions: intent.additionalComponents ?? [] }];
        let expectedVersion = intent.expectedVersion;
        let result: Sale | null = null;
        for (const [index, group] of groups.entries()) {
          result = await client.addSaleLine(
            intent.saleId,
            {
              expectedVersion,
              catalogItemId: intent.catalogItemId,
              ...(intent.catalogVariantId ? { catalogVariantId: intent.catalogVariantId } : {}),
              quantity: group.quantity,
              ...(intent.soldByEmployeeId ? { soldByEmployeeId: intent.soldByEmployeeId } : {}),
              ...(group.additions.length
                ? {
                    additionalComponents: group.additions.map(startAddition),
                  }
                : {}),
            },
            index === 0 ? intent.addIdempotencyKey : `${intent.addIdempotencyKey}:${index}`,
          );
          expectedVersion = result.version;
        }
        return result!;
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
      setHandoverSale(sale);
      setRetryCommitIntent(null);
      navigate(`/sell/${sale.id}`, { replace: true });
    },
    onError: async (error) => {
      if (isKnownApiFailure(error)) setRetryCommitIntent(null);
      await command.recoverFailure(error);
    },
  });

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
    onError: async (_error, intent) => {
      await command.refetchSale(intent.saleId);
    },
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

  const replaceLineMutation = useMutation({
    mutationFn: (intent: {
      saleId: string;
      saleLineId: string;
      expectedVersion: number;
      lines: ReplaceSaleLineInput['lines'];
      idempotencyKey: string;
    }) =>
      command.runMutation(async () => {
        if (connectivity === 'OFFLINE')
          throw new Error(copy('Reconnect before changing this transaction.'));
        if (!client.replaceSaleLine)
          throw new Error(copy('Editing this item is not available here.'));
        return client.replaceSaleLine(
          intent.saleId,
          intent.saleLineId,
          { expectedVersion: intent.expectedVersion, lines: intent.lines },
          intent.idempotencyKey,
        );
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
      setRetryCommitIntent(null);
      setDraft((current) =>
        addCartDraftSelection(
          current ?? emptyCartDraft(selectedLocationId, currency),
          configuration.catalogItem,
          configuration.catalogVariant,
          configuration.resolvedPrice,
          {
            ...(configuration.quantity ? { quantity: configuration.quantity } : {}),
            ...(configuration.additionalComponents
              ? { additionalComponents: configuration.additionalComponents }
              : {}),
            ...(configuration.unitAdditions ? { unitAdditions: configuration.unitAdditions } : {}),
            ...(configuration.soldBy ? { soldBy: configuration.soldBy } : {}),
          },
        ),
      );
      return;
    }
    const compatibleLine =
      configuration && !configuration.unitAdditions
        ? currentSale.lines.find((line) => isCompatibleLine(line, catalogVariantId, configuration))
        : undefined;
    if (compatibleLine) {
      changeQuantity(
        compatibleLine,
        createDecimal(compatibleLine.quantity)
          .plus(configuration?.quantity ?? '1')
          .toFixed(4),
      );
      return;
    }
    const intent: AddItemIntent = {
      catalogItemId,
      ...(catalogVariantId ? { catalogVariantId } : {}),
      quantity: configuration?.quantity ?? '1',
      ...(configuration?.additionalComponents?.length
        ? { additionalComponents: configuration.additionalComponents }
        : {}),
      ...(configuration?.unitAdditions ? { unitAdditions: configuration.unitAdditions } : {}),
      ...(configuration?.soldBy ? { soldByEmployeeId: configuration.soldBy.employeeId } : {}),
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
    saleQuery.data?.customer ??
    handoverSale?.customer ??
    draftCustomerSnapshot(draft?.customer ?? null);

  const changeCustomer = async (selection: SaleCustomerSelection) => {
    const sale = saleQuery.data;
    if (!sale) {
      setDraft((current) =>
        setCartDraftCustomer(
          current ?? emptyCartDraft(selectedLocationId ?? '', currency),
          selection,
        ),
      );
      setRetryCommitIntent(null);
      return;
    }
    await customerMutation.mutateAsync({
      saleId: sale.id,
      expectedVersion: sale.version,
      customer: selection,
    });
  };

  const commitDraft = async () => {
    // The draft on screen during the handover is already this Sale; never start a second one.
    if (handoverSale) return handoverSale;
    if (!draft?.lines.length) throw new Error(copy('Add at least one item before payment.'));
    const intent =
      retryCommitIntent?.draft === draft
        ? retryCommitIntent
        : { draft, idempotencyKey: createIdempotencyKey('start-sale') };
    setRetryCommitIntent(intent);
    return draftCommitGateRef.current.run(() => commitDraftMutation.mutateAsync(intent));
  };

  const applyLoyaltyRedemption = async (points: string) => {
    const sale = saleQuery.data;
    if (!sale || sale.customer?.type !== 'MEMBER' || !points.trim()) return null;
    return loyaltyRedemptionMutation.mutateAsync({
      saleId: sale.id,
      expectedVersion: sale.version,
      points,
    });
  };
  const removeLoyaltyRedemption = () => {
    const sale = saleQuery.data;
    if (!sale?.loyaltyRedemption) return;
    removeLoyaltyRedemptionMutation.mutate({ saleId: sale.id, expectedVersion: sale.version });
  };
  const activeSaleLines = viewModel.activeLines;
  const draftLines = cartDraftDisplayLines(draft);
  const cartLines = saleQuery.data
    ? saleDisplayLines(activeSaleLines, saleQuery.data.adjustments ?? [], {
        canEdit:
          saleQuery.data.status === 'OPEN' && viewModel.monetaryMutation.state === 'AVAILABLE',
      })
    : draftLines;
  const cartTotal = saleQuery.data?.totalAmount ?? cartDraftEstimatedTotal(draft);

  return {
    sale: saleQuery.data ?? null,
    viewModel,
    customer: activeCustomer,
    isCustomerPending: customerMutation.isPending,
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
      /** What Runtime prices read-only while the cart is still a local draft. */
      pricingInput: saleQuery.data ? null : cartDraftPricingInput(draft),
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
    /**
     * Edits a persisted OPEN Sale line in place through Runtime's own boundary: one atomic step,
     * recalculated authoritatively, refused by Runtime when it would fall below successful
     * payments. Nothing about the edit is decided in Web after the Sale exists.
     */
    replaceSaleLine: (
      line: SaleLine,
      configuration: {
        catalogItemId: string;
        catalogVariantId: string | null;
        quantity: string;
        additionalComponents: readonly CartDraftAdditionalItem[];
        unitAdditions?: readonly (readonly CartDraftAdditionalItem[])[];
        soldByEmployeeId?: string | null;
      },
    ) => {
      const sale = saleQuery.data;
      if (!sale || viewModel.monetaryMutation.state !== 'AVAILABLE') return;
      replaceLineMutation.mutate({
        saleId: sale.id,
        saleLineId: line.id,
        expectedVersion: sale.version,
        idempotencyKey: createIdempotencyKey('replace-line'),
        lines: replacementLinesOf(
          configuration.catalogItemId,
          configuration.catalogVariantId,
          configuration,
        ),
      });
    },
    getDraftLine: (lineId: string) => draft?.lines.find((line) => line.id === lineId) ?? null,
    /** Replaces the whole configuration of one local draft line; nothing is merged or persisted. */
    replaceDraftLine: (lineId: string, configuration: AddItemConfiguration) => {
      try {
        setRetryCommitIntent(null);
        setDraft((current) =>
          current
            ? replaceCartDraftLine(
                current,
                lineId,
                configuration.catalogItem,
                configuration.catalogVariant,
                configuration.resolvedPrice,
                {
                  ...(configuration.quantity ? { quantity: configuration.quantity } : {}),
                  ...(configuration.additionalComponents
                    ? { additionalComponents: configuration.additionalComponents }
                    : {}),
                  ...(configuration.unitAdditions
                    ? { unitAdditions: configuration.unitAdditions }
                    : {}),
                  soldBy: configuration.soldBy ?? null,
                },
              )
            : current,
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
      setHandoverSale(null);
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
