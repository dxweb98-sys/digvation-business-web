import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { useLocationBoundQueueState } from './workshop-queue-location-state';

const LOCATION_A = '11111111-1111-4111-8111-111111111111';
const LOCATION_B = '22222222-2222-4222-8222-222222222222';

const workOrderFromA: WorkshopQueueWorkOrder = {
  id: 'wo-a',
  workOrderNumber: 'WO-20260928-000001',
  workStatus: 'IN_PROGRESS',
  sellingLocationId: LOCATION_A,
  customerNameSnapshot: 'Budi',
  customerPhoneSnapshot: '+628123456789',
  vehiclePlateSnapshot: 'B 1234 XYZ',
  vehicleChassisNumberSnapshot: 'CHS1',
  customerRequest: 'rem bunyi',
  cancellationReason: null,
  mechanic: null,
  version: 3,
  createdAt: '2026-09-28T00:00:00.000Z',
  updatedAt: '2026-09-28T00:00:00.000Z',
};

/** Puts the page in the state where a stale location would be dangerous. */
function openCancellationOnPageThree(result: {
  current: ReturnType<typeof useLocationBoundQueueState>;
}) {
  act(() => {
    result.current.setOffset(40);
    result.current.setSelected(workOrderFromA);
    result.current.setCancelling(true);
    result.current.setCancelReason('Customer changed mind');
  });
}

describe('useLocationBoundQueueState', () => {
  it('starts on page one with nothing selected', () => {
    const { result } = renderHook(() => useLocationBoundQueueState(LOCATION_A));

    expect(result.current.offset).toBe(0);
    expect(result.current.selected).toBeNull();
    expect(result.current.isCancelling).toBe(false);
    expect(result.current.cancelReason).toBe('');
  });

  it('leaves no previous-location Work Order open or cancellable after the active location changes', () => {
    const { result, rerender } = renderHook(
      ({ locationId }) => useLocationBoundQueueState(locationId),
      { initialProps: { locationId: LOCATION_A } },
    );
    openCancellationOnPageThree(result);
    expect(result.current.selected?.id).toBe('wo-a');

    rerender({ locationId: LOCATION_B });

    expect(result.current.selected).toBeNull();
    expect(result.current.isCancelling).toBe(false);
    expect(result.current.cancelReason).toBe('');
  });

  it('returns to page one so a location with fewer pages is not shown as empty', () => {
    const { result, rerender } = renderHook(
      ({ locationId }) => useLocationBoundQueueState(locationId),
      { initialProps: { locationId: LOCATION_A } },
    );
    openCancellationOnPageThree(result);
    expect(result.current.offset).toBe(40);

    rerender({ locationId: LOCATION_B });

    expect(result.current.offset).toBe(0);
  });

  it('never renders the stale Work Order for the new location, not even for one render', () => {
    const seen: Array<{ locationId: string; selectedId: string | undefined }> = [];
    const { result, rerender } = renderHook(
      ({ locationId }) => {
        const state = useLocationBoundQueueState(locationId);
        seen.push({ locationId, selectedId: state.selected?.id });
        return state;
      },
      { initialProps: { locationId: LOCATION_A } },
    );
    openCancellationOnPageThree(result);
    seen.length = 0;

    rerender({ locationId: LOCATION_B });

    const committedForB = seen.filter((entry) => entry.locationId === LOCATION_B);
    // React may re-run the render function while applying the reset, but the
    // last (committed) render for the new location must carry no Work Order.
    expect(committedForB.at(-1)?.selectedId).toBeUndefined();
  });

  it('keeps the state while the location is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ locationId }) => useLocationBoundQueueState(locationId),
      { initialProps: { locationId: LOCATION_A } },
    );
    openCancellationOnPageThree(result);

    rerender({ locationId: LOCATION_A });

    expect(result.current.offset).toBe(40);
    expect(result.current.selected?.id).toBe('wo-a');
    expect(result.current.isCancelling).toBe(true);
    expect(result.current.cancelReason).toBe('Customer changed mind');
  });

  it('resets again on every later location change, including back to the first location', () => {
    const { result, rerender } = renderHook(
      ({ locationId }) => useLocationBoundQueueState(locationId),
      { initialProps: { locationId: LOCATION_A } },
    );
    rerender({ locationId: LOCATION_B });
    openCancellationOnPageThree(result);

    rerender({ locationId: LOCATION_A });

    expect(result.current.offset).toBe(0);
    expect(result.current.selected).toBeNull();
  });
});
