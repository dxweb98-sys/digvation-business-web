import { createDecimal } from '@digvation/business-money';
import type { ConnectivityState } from '@digvation/business-runtime';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import type { SaleTransactionClient } from './cashier-transaction.adapter';
import { isKnownApiFailure } from './cashier-transaction-errors';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import type { CatalogItem, ResolvedPrice, SaleLine } from './cashier-transaction.types';
import { createSaleWorkspaceViewModel } from './sale-workspace-view-model';
import type { SaleCommandCoordinator } from './use-sale-command-coordinator';

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,14})(\.\d{1,4})?$/;

interface AddItemIntent {
  catalogItemId: string;
  catalogVariantId?: string;
  quantity: string;
  sellingLocationId: string;
  currency: string;
  createIdempotencyKey: string;
  addIdempotencyKey: string;
  saleId?: string;
  expectedVersion?: number;
}

interface AddItemConfiguration {
  catalogItem: CatalogItem;
  resolvedPrice: ResolvedPrice;
}

interface UseSaleWorkspaceControllerOptions {
  client: SaleTransactionClient;
  command: SaleCommandCoordinator;
  routeSaleId?: string;
  selectedLocationId: string | null;
  currency: string;
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
  connectivity,
  selectLocation,
  rememberSale,
}: UseSaleWorkspaceControllerOptions) {
  const navigate = useNavigate();
  const createdSaleIdRef = useRef<string | null>(null);
  const [retryIntent, setRetryIntent] = useState<AddItemIntent | null>(null);

  const saleQuery = useQuery({
    queryKey: cashierTransactionKeys.sale(routeSaleId ?? 'idle'),
    queryFn: ({ signal }) => client.getSale(routeSaleId!, signal),
    enabled: Boolean(routeSaleId),
  });

  useEffect(() => {
    const sale = saleQuery.data;
    if (!sale) return;
    rememberSale(sale.id);
    if (selectedLocationId !== sale.sellingLocationId) selectLocation(sale.sellingLocationId);
  }, [rememberSale, saleQuery.data, selectLocation, selectedLocationId]);

  const addItemMutation = useMutation({
    mutationFn: (intent: AddItemIntent) =>
      command.runMutation(async () => {
        if (connectivity === 'OFFLINE') throw new Error('Reconnect before changing this Sale.');

        let saleId = intent.saleId;
        let expectedVersion = intent.expectedVersion;
        let createdSale: typeof saleQuery.data | null = null;
        createdSaleIdRef.current = saleId ?? null;

        if (!saleId || expectedVersion === undefined) {
          createdSale = await client.createSale(
            { sellingLocationId: intent.sellingLocationId, currency: intent.currency },
            intent.createIdempotencyKey,
          );
          saleId = createdSale.id;
          expectedVersion = createdSale.version;
          createdSaleIdRef.current = createdSale.id;
          selectLocation(createdSale.sellingLocationId);
          setRetryIntent({ ...intent, saleId, expectedVersion });
        }

        try {
          const updatedSale = await client.addSaleLine(
            saleId,
            {
              expectedVersion,
              catalogItemId: intent.catalogItemId,
              ...(intent.catalogVariantId ? { catalogVariantId: intent.catalogVariantId } : {}),
              quantity: intent.quantity,
            },
            intent.addIdempotencyKey,
          );
          command.commitSale(updatedSale);
          if (createdSale) navigate(`/sell/${createdSale.id}`, { replace: true });
          return updatedSale;
        } catch (error) {
          if (createdSale) {
            command.commitSale(createdSale);
            navigate(`/sell/${createdSale.id}`, { replace: true });
          }
          throw error;
        }
      }),
    onSuccess: (sale) => {
      command.commitSale(sale);
      createdSaleIdRef.current = null;
      setRetryIntent(null);
    },
    onError: async (error, intent) => {
      const saleId = intent.saleId ?? createdSaleIdRef.current ?? undefined;
      if (isKnownApiFailure(error)) setRetryIntent(null);
      await command.recoverFailure(error, saleId);
    },
  });

  const quantityMutation = useMutation({
    mutationFn: (intent: {
      saleId: string;
      saleLineId: string;
      expectedVersion: number;
      quantity: string;
    }) =>
      command.runMutation(async () => {
        if (connectivity === 'OFFLINE') throw new Error('Reconnect before changing this Sale.');
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
        if (connectivity === 'OFFLINE') throw new Error('Reconnect before changing this Sale.');
        return client.removeSaleLine(intent.saleId, intent.saleLineId, intent.expectedVersion);
      }),
    onSuccess: command.commitSale,
    onError: async (error, intent) => command.recoverFailure(error, intent.saleId),
  });

  const viewModel = createSaleWorkspaceViewModel(
    saleQuery.data ?? null,
    connectivity,
    command.effectiveSynchronization,
  );

  const addItem = (
    catalogItemId: string,
    catalogVariantId?: string,
    configuration?: AddItemConfiguration,
  ) => {
    if (!selectedLocationId) {
      command.reportError(new Error('Select a Branch before starting a Sale.'));
      return;
    }
    if (viewModel.monetaryMutation.state !== 'AVAILABLE') return;

    const currentSale = saleQuery.data;
    const compatibleLine = configuration
      ? currentSale?.lines.find((line) => isCompatibleLine(line, catalogVariantId, configuration))
      : undefined;
    if (compatibleLine) {
      changeQuantity(compatibleLine, createDecimal(compatibleLine.quantity).plus('1').toFixed(4));
      return;
    }
    const intent: AddItemIntent = {
      catalogItemId,
      ...(catalogVariantId ? { catalogVariantId } : {}),
      quantity: '1',
      sellingLocationId: currentSale?.sellingLocationId ?? selectedLocationId,
      currency: currentSale?.currency ?? currency,
      createIdempotencyKey: createIdempotencyKey('create-sale'),
      addIdempotencyKey: createIdempotencyKey('add-line'),
      ...(currentSale ? { saleId: currentSale.id, expectedVersion: currentSale.version } : {}),
    };

    setRetryIntent(intent);
    addItemMutation.mutate(intent);
  };

  const changeQuantity = (line: SaleLine, quantity: string) => {
    const sale = saleQuery.data;
    if (!sale || viewModel.monetaryMutation.state !== 'AVAILABLE') return;
    if (!isPositiveQuantity(quantity)) {
      command.reportError(
        new Error('Quantity must be greater than zero with at most four decimal places.'),
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

  return {
    sale: saleQuery.data ?? null,
    viewModel,
    isLoading: Boolean(routeSaleId) && saleQuery.isLoading,
    canRetryLastAdd: Boolean(retryIntent) && !addItemMutation.isPending,
    addItem,
    changeQuantity,
    removeLine,
    retryLastAdd: () => {
      if (!retryIntent || addItemMutation.isPending) return;
      command.clearNotice();
      addItemMutation.mutate(retryIntent);
    },
    saleQueryError: saleQuery.error,
  };
}
