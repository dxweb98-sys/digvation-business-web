import type { ConnectivityState } from '@digvation/pos-runtime';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type {
  CreatePaymentInput,
  DiscountInput,
  SaleTransactionClient,
} from './cashier-transaction.adapter';
import { isKnownApiFailure } from './cashier-transaction-errors';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import type {
  DiscountType,
  FulfillmentStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Sale,
  SaleLine,
} from './cashier-transaction.types';
import type { SaleCommandCoordinator } from './use-sale-command-coordinator';

interface UseSaleCoreControllerOptions {
  client: SaleTransactionClient;
  command: SaleCommandCoordinator;
  sale: Sale | null;
  connectivity: ConnectivityState;
}

type CoreCommandIntent =
  | {
      kind: 'priceOverride';
      saleId: string;
      lineId: string;
      expectedVersion: number;
      amount: string;
      reason: string;
    }
  | { kind: 'clearPriceOverride'; saleId: string; lineId: string; expectedVersion: number }
  | {
      kind: 'lineDiscount';
      saleId: string;
      lineId: string;
      expectedVersion: number;
      discountType: DiscountType;
      value: string;
      reason: string;
    }
  | { kind: 'clearLineDiscount'; saleId: string; lineId: string; expectedVersion: number }
  | {
      kind: 'orderDiscount';
      saleId: string;
      expectedVersion: number;
      discountType: DiscountType;
      value: string;
      reason: string;
    }
  | { kind: 'clearOrderDiscount'; saleId: string; expectedVersion: number }
  | {
      kind: 'assignments';
      saleId: string;
      lineId: string;
      expectedVersion: number;
      employeeIds: string[];
    }
  | {
      kind: 'contributions';
      saleId: string;
      lineId: string;
      expectedVersion: number;
      contributors: Array<{ employeeId: string; shareRate?: string }>;
    }
  | {
      kind: 'fulfillment';
      saleId: string;
      lineId: string;
      expectedVersion: number;
      status: Exclude<FulfillmentStatus, 'WAITING'>;
    }
  | {
      kind: 'payment';
      saleId: string;
      expectedVersion: number;
      method: PaymentMethod;
      appliedAmount: string;
      tenderedAmount?: string;
      providerReference?: string;
      idempotencyKey: string;
    }
  | {
      kind: 'paymentTransition';
      saleId: string;
      paymentId: string;
      expectedVersion: number;
      status: Exclude<PaymentStatus, 'PENDING'>;
    }
  | { kind: 'finalize'; saleId: string; expectedVersion: number; idempotencyKey: string }
  | { kind: 'void'; saleId: string; expectedVersion: number; idempotencyKey: string };

function createIdempotencyKey(operation: string): string {
  return `cashier-${operation}-${crypto.randomUUID()}`;
}

function isRetryableIntent(intent: CoreCommandIntent): boolean {
  return intent.kind === 'payment' || intent.kind === 'finalize' || intent.kind === 'void';
}

async function executeIntent(
  client: SaleTransactionClient,
  intent: CoreCommandIntent,
): Promise<Sale> {
  switch (intent.kind) {
    case 'priceOverride':
      return client.setSaleLinePriceOverride(intent.saleId, intent.lineId, {
        expectedVersion: intent.expectedVersion,
        amount: intent.amount,
        reason: intent.reason,
      });
    case 'clearPriceOverride':
      return client.clearSaleLinePriceOverride(
        intent.saleId,
        intent.lineId,
        intent.expectedVersion,
      );
    case 'lineDiscount':
      return client.setSaleLineDiscount(intent.saleId, intent.lineId, {
        expectedVersion: intent.expectedVersion,
        type: intent.discountType,
        value: intent.value,
        reason: intent.reason,
      });
    case 'clearLineDiscount':
      return client.clearSaleLineDiscount(intent.saleId, intent.lineId, intent.expectedVersion);
    case 'orderDiscount':
      return client.setSaleDiscount(intent.saleId, {
        expectedVersion: intent.expectedVersion,
        type: intent.discountType,
        value: intent.value,
        reason: intent.reason,
      });
    case 'clearOrderDiscount':
      return client.clearSaleDiscount(intent.saleId, intent.expectedVersion);
    case 'assignments':
      return client.setSaleLineAssignments(intent.saleId, intent.lineId, {
        expectedVersion: intent.expectedVersion,
        employeeIds: intent.employeeIds,
      });
    case 'contributions':
      return client.setSaleLineContributions(intent.saleId, intent.lineId, {
        expectedVersion: intent.expectedVersion,
        contributors: intent.contributors,
      });
    case 'fulfillment':
      return client.transitionSaleLineFulfillment(intent.saleId, intent.lineId, {
        expectedVersion: intent.expectedVersion,
        status: intent.status,
      });
    case 'payment': {
      const input: CreatePaymentInput = {
        expectedVersion: intent.expectedVersion,
        method: intent.method,
        appliedAmount: intent.appliedAmount,
        ...(intent.tenderedAmount ? { tenderedAmount: intent.tenderedAmount } : {}),
        ...(intent.providerReference ? { providerReference: intent.providerReference } : {}),
      };
      return client.createSalePayment(intent.saleId, input, intent.idempotencyKey);
    }
    case 'paymentTransition':
      return client.transitionSalePayment(intent.saleId, intent.paymentId, {
        expectedVersion: intent.expectedVersion,
        status: intent.status,
      });
    case 'finalize':
      return client.finalizeSale(intent.saleId, intent.expectedVersion, intent.idempotencyKey);
    case 'void':
      return client.voidSale(intent.saleId, intent.expectedVersion, intent.idempotencyKey);
  }
}

export function useSaleCoreController({
  client,
  command,
  sale,
  connectivity,
}: UseSaleCoreControllerOptions) {
  const queryClient = useQueryClient();
  const [retryIntent, setRetryIntent] = useState<CoreCommandIntent | null>(null);

  const mutation = useMutation({
    mutationFn: (intent: CoreCommandIntent) =>
      command.runMutation(async () => {
        if (connectivity === 'OFFLINE') throw new Error('Reconnect before changing this Sale.');
        return executeIntent(client, intent);
      }),
    onSuccess: (nextSale, intent) => {
      command.commitSale(nextSale);
      setRetryIntent(null);
      if (intent.kind === 'contributions') {
        void queryClient.invalidateQueries({
          queryKey: cashierTransactionKeys.contributionPreview(intent.saleId, intent.lineId),
        });
      }
    },
    onError: async (error, intent) => {
      if (!isKnownApiFailure(error) && isRetryableIntent(intent)) setRetryIntent(intent);
      else setRetryIntent(null);
      await command.recoverFailure(error, intent.saleId);
    },
  });

  const mutate = (intent: CoreCommandIntent) => {
    if (isRetryableIntent(intent)) setRetryIntent(intent);
    mutation.mutate(intent);
  };

  const mutateAsync = async (intent: CoreCommandIntent): Promise<Sale> => {
    if (isRetryableIntent(intent)) setRetryIntent(intent);
    return mutation.mutateAsync(intent);
  };

  const withSale = <T>(createIntent: (currentSale: Sale) => T): T | null => {
    if (!sale || sale.status !== 'OPEN') return null;
    return createIntent(sale);
  };

  return {
    isPending: mutation.isPending,
    canRetryLastCoreCommand: Boolean(retryIntent) && !mutation.isPending,
    retryLastCoreCommand: () => {
      if (!retryIntent || mutation.isPending) return;
      command.clearNotice();
      mutation.mutate(retryIntent);
    },
    setPriceOverride: (line: SaleLine, amount: string, reason: string) => {
      const intent = withSale((currentSale) => ({
        kind: 'priceOverride' as const,
        saleId: currentSale.id,
        lineId: line.id,
        expectedVersion: currentSale.version,
        amount,
        reason,
      }));
      if (intent) mutate(intent);
    },
    clearPriceOverride: (line: SaleLine) => {
      const intent = withSale((currentSale) => ({
        kind: 'clearPriceOverride' as const,
        saleId: currentSale.id,
        lineId: line.id,
        expectedVersion: currentSale.version,
      }));
      if (intent) mutate(intent);
    },
    setLineDiscount: (line: SaleLine, input: Omit<DiscountInput, 'expectedVersion'>) => {
      const intent = withSale((currentSale) => ({
        kind: 'lineDiscount' as const,
        saleId: currentSale.id,
        lineId: line.id,
        expectedVersion: currentSale.version,
        discountType: input.type,
        value: input.value,
        reason: input.reason,
      }));
      if (intent) mutate(intent);
    },
    clearLineDiscount: (line: SaleLine) => {
      const intent = withSale((currentSale) => ({
        kind: 'clearLineDiscount' as const,
        saleId: currentSale.id,
        lineId: line.id,
        expectedVersion: currentSale.version,
      }));
      if (intent) mutate(intent);
    },
    setOrderDiscount: (input: Omit<DiscountInput, 'expectedVersion'>) => {
      const intent = withSale((currentSale) => ({
        kind: 'orderDiscount' as const,
        saleId: currentSale.id,
        expectedVersion: currentSale.version,
        discountType: input.type,
        value: input.value,
        reason: input.reason,
      }));
      if (intent) mutate(intent);
    },
    clearOrderDiscount: () => {
      const intent = withSale((currentSale) => ({
        kind: 'clearOrderDiscount' as const,
        saleId: currentSale.id,
        expectedVersion: currentSale.version,
      }));
      if (intent) mutate(intent);
    },
    setAssignments: (line: SaleLine, employeeIds: string[]) => {
      const intent = withSale((currentSale) => ({
        kind: 'assignments' as const,
        saleId: currentSale.id,
        lineId: line.id,
        expectedVersion: currentSale.version,
        employeeIds,
      }));
      if (intent) mutate(intent);
    },
    setContributions: (
      line: SaleLine,
      contributors: Array<{ employeeId: string; shareRate?: string }>,
    ) => {
      const intent = withSale((currentSale) => ({
        kind: 'contributions' as const,
        saleId: currentSale.id,
        lineId: line.id,
        expectedVersion: currentSale.version,
        contributors,
      }));
      if (intent) mutate(intent);
    },
    transitionFulfillment: async (
      line: SaleLine,
      status: Exclude<FulfillmentStatus, 'WAITING'>,
    ) => {
      const intent = withSale((currentSale) => ({
        kind: 'fulfillment' as const,
        saleId: currentSale.id,
        lineId: line.id,
        expectedVersion: currentSale.version,
        status,
      }));
      if (!intent) throw new Error('No active Sale is available for fulfillment update.');
      return mutateAsync(intent);
    },
    createPayment: async (
      method: PaymentMethod,
      appliedAmount: string,
      tenderedAmount?: string,
      providerReference?: string,
    ) => {
      const intent = withSale((currentSale) => ({
        kind: 'payment' as const,
        saleId: currentSale.id,
        expectedVersion: currentSale.version,
        method,
        appliedAmount,
        ...(tenderedAmount ? { tenderedAmount } : {}),
        ...(providerReference ? { providerReference } : {}),
        idempotencyKey: createIdempotencyKey('payment'),
      }));
      if (!intent) throw new Error('No active Sale is available for payment.');
      return mutateAsync(intent);
    },
    transitionPayment: (payment: Payment, status: Exclude<PaymentStatus, 'PENDING'>) => {
      const intent = withSale((currentSale) => ({
        kind: 'paymentTransition' as const,
        saleId: currentSale.id,
        paymentId: payment.id,
        expectedVersion: currentSale.version,
        status,
      }));
      if (intent) mutate(intent);
    },
    finalizeSale: () => {
      const intent = withSale((currentSale) => ({
        kind: 'finalize' as const,
        saleId: currentSale.id,
        expectedVersion: currentSale.version,
        idempotencyKey: createIdempotencyKey('finalize'),
      }));
      if (intent) mutate(intent);
    },
    voidSale: async () => {
      const intent = withSale((currentSale) => ({
        kind: 'void' as const,
        saleId: currentSale.id,
        expectedVersion: currentSale.version,
        idempotencyKey: createIdempotencyKey('void'),
      }));
      if (!intent) throw new Error('No active Sale is available for cancellation.');
      return mutateAsync(intent);
    },
  };
}
