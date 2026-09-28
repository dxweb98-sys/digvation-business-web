import { useState } from 'react';

import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';

/**
 * Queue UI state that belongs to ONE active Operational location: the page
 * offset, the open Work Order detail and the cancellation form.
 *
 * When the canonical Operational `selectedLocationId` changes, all of it is
 * reset in the same render (before anything is committed), so a Work Order
 * opened under location A can never stay actionable while location B is
 * active, and a page offset from A cannot show B's shorter queue as empty.
 * Search text and status filter are deliberately not location-bound and stay
 * with the page.
 */
export function useLocationBoundQueueState(locationId: string | null | undefined) {
  const [scopeLocationId, setScopeLocationId] = useState(locationId);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<WorkshopQueueWorkOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setCancelling] = useState(false);

  if (scopeLocationId !== locationId) {
    // React re-renders immediately with these values and discards this pass.
    setScopeLocationId(locationId);
    setOffset(0);
    setSelected(null);
    setCancelReason('');
    setCancelling(false);
  }

  return {
    offset,
    setOffset,
    selected,
    setSelected,
    cancelReason,
    setCancelReason,
    isCancelling,
    setCancelling,
  };
}
