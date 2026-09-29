import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { useToast } from '@digvation/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { WorkshopBillingApi, type WorkshopBilling } from '../api/workshop-billing-api';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import {
  canReadBilling,
  WORKSHOP_BILLING_ERROR_COPY,
  WORKSHOP_BILLING_STALE_CODES,
} from './workshop-billing-model';

/**
 * The Work Order version is part of the key: an item adjustment or a
 * lifecycle step gives the open Work Order a new version, which refreshes the
 * billing from Runtime instead of showing amounts of a previous item set.
 */
const billingKey = (id: string, version: number) => ['workshop-billing', id, version] as const;

function errorCode(error: unknown): string | undefined {
  return (error as { code?: string } | undefined)?.code;
}

/**
 * The current billing draft of the open Work Order and its explicit
 * validation. Runtime is the only source of amounts and state; a Work Order
 * without items has no billing yet (`billing` is null).
 */
export function useWorkOrderBilling({
  workOrder,
  permissions,
}: {
  workOrder: WorkshopQueueWorkOrder;
  permissions: readonly string[];
}) {
  const bootstrap = useDeploymentBootstrap();
  const { authPort } = useAuth();
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [validateOpen, setValidateOpen] = useState(false);
  const readable = canReadBilling(workOrder.workStatus, permissions);

  const api = useMemo(
    () =>
      new WorkshopBillingApi(
        new ApiClient({
          baseUrl: bootstrap.apiBaseUrl,
          applicationSurface: 'operational',
          ...(authPort.getAccessToken
            ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
            : {}),
        }),
      ),
    [authPort, bootstrap.apiBaseUrl],
  );

  const key = billingKey(workOrder.id, workOrder.version);
  const query = useQuery({
    queryKey: key,
    enabled: readable,
    queryFn: async (): Promise<WorkshopBilling | null> => {
      try {
        return await api.getBilling(workOrder.id);
      } catch (error) {
        if (errorCode(error) === 'WORKSHOP_BILLING_LINES_REQUIRED') return null;
        throw error;
      }
    },
    staleTime: 0,
    placeholderData: keepPreviousData,
  });

  const validate = useMutation({
    mutationFn: (expectedVersion: number) => api.validateBilling(workOrder.id, expectedVersion),
    onSuccess: (validated) => {
      queryClient.setQueryData(key, validated);
      setValidateOpen(false);
      showToast({ variant: 'success', title: copy('Billing validated.') });
    },
    onError: (error) => {
      const code = errorCode(error) ?? '';
      const known = WORKSHOP_BILLING_ERROR_COPY[code];
      const stale = WORKSHOP_BILLING_STALE_CODES.includes(code);
      showToast({
        variant: 'danger',
        title: copy(
          known ??
            (stale
              ? 'The billing changed. Review the new amounts and try again.'
              : 'Could not validate the billing. Try again.'),
        ),
      });
      setValidateOpen(false);
      // The reviewed numbers are out of date: show what Runtime calculated now.
      if (stale || known) void query.refetch();
    },
  });

  return {
    readable,
    billing: query.data ?? null,
    loading: query.isLoading,
    failed: query.isError && !query.data,
    retry: () => void query.refetch(),
    validateOpen,
    openValidate: () => setValidateOpen(true),
    closeValidate: () => setValidateOpen(false),
    validate: (expectedVersion: number) => validate.mutate(expectedVersion),
    validatePending: validate.isPending,
  };
}
