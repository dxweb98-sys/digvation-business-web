import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { SaleTransactionClient } from './cashier-transaction.adapter';
import {
  cashierTransactionErrorMessage,
  isApiErrorCode,
  isKnownApiFailure,
  isSaleVersionConflict,
} from './cashier-transaction-errors';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import type { Sale } from './cashier-transaction.types';
import type { SynchronizationState } from './sale-workspace-view-model';

interface UseSaleCommandCoordinatorOptions {
  client: SaleTransactionClient;
  rememberSale: (saleId: string) => void;
}

export function useSaleCommandCoordinator({
  client,
  rememberSale,
}: UseSaleCommandCoordinatorOptions) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [synchronization, setSynchronization] = useState<SynchronizationState>('CLEAN');
  const [activeMutationCount, setActiveMutationCount] = useState(0);

  const commitSale = useCallback(
    (sale: Sale) => {
      queryClient.setQueryData(cashierTransactionKeys.sale(sale.id), sale);
      void queryClient.invalidateQueries({ queryKey: cashierTransactionKeys.sales() });
      rememberSale(sale.id);
      setSynchronization('CLEAN');
      setNotice(null);
    },
    [queryClient, rememberSale],
  );

  const refetchSale = useCallback(
    async (saleId: string): Promise<Sale | null> => {
      try {
        const latest = await client.getSale(saleId);
        queryClient.setQueryData(cashierTransactionKeys.sale(saleId), latest);
        rememberSale(latest.id);
        return latest;
      } catch (error) {
        setNotice(cashierTransactionErrorMessage(error));
        return null;
      }
    },
    [client, queryClient, rememberSale],
  );

  const recoverFailure = useCallback(
    async (error: unknown, saleId?: string) => {
      if (isSaleVersionConflict(error)) {
        if (saleId) await refetchSale(saleId);
        setSynchronization('CONFLICT_REVIEW');
        setNotice(
          'This Sale changed on another terminal. Review the latest server state before continuing.',
        );
        return;
      }

      if (isApiErrorCode(error, 'SALE_PAYMENT_PENDING')) {
        if (saleId) await refetchSale(saleId);
        setSynchronization('CLEAN');
        setNotice(cashierTransactionErrorMessage(error));
        return;
      }

      if (!isKnownApiFailure(error)) {
        if (saleId) await refetchSale(saleId);
        setSynchronization('UNCERTAIN_COMMAND');
        setNotice(
          saleId
            ? 'The command result is uncertain. The latest Sale was reloaded; review it before continuing.'
            : 'The command result is uncertain. Retry only through the preserved idempotent action when available.',
        );
        return;
      }

      setSynchronization('CLEAN');
      setNotice(cashierTransactionErrorMessage(error));
    },
    [refetchSale],
  );

  const runMutation = useCallback(async <T>(operation: () => Promise<T>): Promise<T> => {
    setActiveMutationCount((count) => count + 1);
    try {
      return await operation();
    } finally {
      setActiveMutationCount((count) => Math.max(0, count - 1));
    }
  }, []);

  const effectiveSynchronization = useMemo<SynchronizationState>(
    () => (activeMutationCount > 0 ? 'MUTATING' : synchronization),
    [activeMutationCount, synchronization],
  );

  return {
    notice,
    synchronization,
    effectiveSynchronization,
    isMutating: activeMutationCount > 0,
    commitSale,
    refetchSale,
    recoverFailure,
    runMutation,
    reportError: (error: unknown) => setNotice(cashierTransactionErrorMessage(error)),
    clearNotice: () => setNotice(null),
    acknowledgeLatestState: () => {
      setSynchronization('CLEAN');
      setNotice(null);
    },
    clearAttention: () => {
      setSynchronization('CLEAN');
      setNotice(null);
    },
  };
}

export type SaleCommandCoordinator = ReturnType<typeof useSaleCommandCoordinator>;
