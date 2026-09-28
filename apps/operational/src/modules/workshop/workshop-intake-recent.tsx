import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { DBadge, DButton, DSkeleton } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

import { liveQueryPolicy, QUEUE_REFRESH_INTERVAL_MS } from '../../app/data/operational-cache-policy';
import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { useOperationalSession } from '../operational/operational-session-provider';
import { WorkshopQueueApi } from './workshop-queue-api';
import { STATUS_BADGE_VARIANT } from './workshop-status-presentation';

export const RECENT_WORK_ORDER_LIMIT = 5;

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The latest Work Orders of the active Operational location, read from the
 * existing Workshop queue list contract (newest first). Only mounted for
 * users with `workshop-queue:read`, and it never blocks the Intake action:
 * loading and failure stay inside this section.
 */
export function WorkshopRecentWorkOrders({
  onOpenQueue,
  highlightId,
}: {
  onOpenQueue: () => void;
  /** The Work Order just created, marked in the list. */
  highlightId?: string | null;
}) {
  const bootstrap = useDeploymentBootstrap();
  const { authPort } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy, label, formatDate } = useOperationalLocalization();

  const api = useMemo(
    () =>
      new WorkshopQueueApi(
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

  // Keyed by location and under the shared 'workshop-queue' prefix, so a
  // lifecycle command or a new Work Order refreshes it with the queue.
  const recent = useQuery({
    queryKey: ['workshop-queue', selectedLocationId, 'recent', RECENT_WORK_ORDER_LIMIT],
    enabled: Boolean(selectedLocationId),
    queryFn: () =>
      api.list({
        limit: RECENT_WORK_ORDER_LIMIT,
        offset: 0,
        sellingLocationId: selectedLocationId!,
      }),
    ...liveQueryPolicy,
    refetchInterval: QUEUE_REFRESH_INTERVAL_MS,
  });

  const items = selectedLocationId ? (recent.data?.items ?? []) : [];
  const now = new Date();

  return (
    <section aria-labelledby="recent-work-orders">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-work-orders" className="text-base font-semibold text-(--color-text)">
          {copy('Recent Work Orders')}
        </h2>
        <DButton variant="link" size="sm" className="px-0" onClick={onOpenQueue}>
          <span className="inline-flex items-center gap-1">
            {copy('Open queue')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </DButton>
      </div>

      <div className="mt-2 border-t border-(--color-border)">
        {recent.isError ? (
          <div className="flex items-center justify-between gap-3 py-4">
            <p className="text-sm text-(--color-text-muted)">
              {copy('Could not load recent Work Orders.')}
            </p>
            <DButton variant="link" size="sm" className="px-0" onClick={() => void recent.refetch()}>
              {copy('Retry')}
            </DButton>
          </div>
        ) : recent.isLoading || !selectedLocationId ? (
          <div className="py-3" aria-hidden="true">
            <DSkeleton count={RECENT_WORK_ORDER_LIMIT} height={44} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-6">
            <p className="text-sm font-medium text-(--color-text)">
              {copy('No Work Orders at this branch yet.')}
            </p>
            <p className="mt-0.5 text-sm text-(--color-text-muted)">
              {copy('Start the first one with the Create Work Order button.')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-(--color-border)">
            {items.map((workOrder) => {
              const createdAt = new Date(workOrder.createdAt);
              return (
                <li
                  key={workOrder.id}
                  className={
                    workOrder.id === highlightId
                      ? 'flex items-start justify-between gap-4 bg-(--color-brand)/5 px-2 py-3'
                      : 'flex items-start justify-between gap-4 px-2 py-3'
                  }
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-(--color-text)">
                      {workOrder.workOrderNumber}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-(--color-text)">
                      <span className="font-medium">{workOrder.vehiclePlateSnapshot}</span>
                      <span className="text-(--color-text-muted)">
                        {' '}
                        {workOrder.customerNameSnapshot}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <DBadge variant={STATUS_BADGE_VARIANT[workOrder.workStatus]}>
                      {label(workOrder.workStatus)}
                    </DBadge>
                    <time
                      dateTime={workOrder.createdAt}
                      className="text-xs tabular-nums text-(--color-text-muted)"
                    >
                      {isSameDay(createdAt, now)
                        ? formatDate(createdAt, { timeStyle: 'short' })
                        : formatDate(createdAt, { day: 'numeric', month: 'short' })}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
