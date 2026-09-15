import { useRuntime } from '@digvation/pos-runtime';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../app/localization/operational-localization';
import type { SaleTransactionClient } from './cashier-transaction.adapter';
import {
  cashierTransactionErrorMessage,
  isApiErrorCode,
  isKnownApiFailure,
  isSaleVersionConflict,
} from './cashier-transaction-errors';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import type { ApiPage, Sale } from './cashier-transaction.types';
import type { SynchronizationState } from './sale-workspace-view-model';

interface UseSaleCommandCoordinatorOptions {
  client: SaleTransactionClient;
  rememberSale: (saleId: string) => void;
}

export function useSaleCommandCoordinator({
  client,
  rememberSale,
}: UseSaleCommandCoordinatorOptions) {
  const runtime = useRuntime();
  const locale = runtime.locale;
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [synchronization, setSynchronization] = useState<SynchronizationState>('CLEAN');
  const [activeMutationCount, setActiveMutationCount] = useState(0);
  const copy = useCallback(
    (value: string) => operationalCopy(value, resolveOperationalLocale(locale)),
    [locale],
  );

  const commitSale = useCallback(
    (sale: Sale) => {
      queryClient.setQueryData(cashierTransactionKeys.sale(sale.id), sale);
      queryClient.setQueryData<ApiPage<Sale>>(cashierTransactionKeys.sales(), (page) => {
        if (!page) {
          if (sale.operationalState === 'UNSUBMITTED') return page;
          return {
            items: [sale],
            limit: 100,
            offset: 0,
          };
        }

        const existingIndex = page.items.findIndex((item) => item.id === sale.id);
        if (existingIndex === -1) {
          if (sale.operationalState === 'UNSUBMITTED') return page;
          return {
            ...page,
            items: [sale, ...page.items].slice(0, page.limit),
          };
        }

        const existing = page.items[existingIndex];
        if (existing && existing.version > sale.version) return page;

        return {
          ...page,
          items: page.items.map((item) => (item.id === sale.id ? sale : item)),
        };
      });
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
        setNotice(cashierTransactionErrorMessage(error, locale));
        return null;
      }
    },
    [client, locale, queryClient, rememberSale],
  );

  const recoverFailure = useCallback(
    async (error: unknown, saleId?: string) => {
      if (isSaleVersionConflict(error)) {
        if (saleId) await refetchSale(saleId);
        setSynchronization('CONFLICT_REVIEW');
        setNotice(copy('Transaction changed. Review the latest data before continuing.'));
        return;
      }

      if (isApiErrorCode(error, 'SALE_PAYMENT_PENDING')) {
        if (saleId) await refetchSale(saleId);
        setSynchronization('CLEAN');
        setNotice(cashierTransactionErrorMessage(error, locale));
        return;
      }

      if (!isKnownApiFailure(error)) {
        if (saleId) await refetchSale(saleId);
        setSynchronization('UNCERTAIN_COMMAND');
        setNotice(
          copy(
            saleId
              ? 'The latest transaction could not be confirmed. Review it before continuing.'
              : 'The result could not be confirmed. Try again from the current transaction.',
          ),
        );
        return;
      }

      setSynchronization('CLEAN');
      setNotice(cashierTransactionErrorMessage(error, locale));
    },
    [copy, locale, refetchSale],
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
    reportError: (error: unknown) => setNotice(cashierTransactionErrorMessage(error, locale)),
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
