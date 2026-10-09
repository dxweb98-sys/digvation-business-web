import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_REFRESH_INTERVAL_MS,
  QUEUE_REFRESH_INTERVAL_MS,
  historyQueryPolicy,
  liveQueryPolicy,
  operationalQueryClientDefaults,
  referenceQueryPolicy,
  transactionQueryPolicy,
} from './operational-cache-policy';

describe('operational cache policy', () => {
  it('never refetches everything just because the operator came back to the tab', () => {
    expect(operationalQueryClientDefaults.queries.refetchOnWindowFocus).toBe(false);
    expect(referenceQueryPolicy.refetchOnWindowFocus).toBe(false);
    expect(transactionQueryPolicy.refetchOnWindowFocus).toBe(false);
    expect(historyQueryPolicy.refetchOnWindowFocus).toBe(false);
  });

  it('reuses configuration data across navigation instead of refetching on mount', () => {
    expect(referenceQueryPolicy.refetchOnMount).toBe(false);
    expect(historyQueryPolicy.refetchOnMount).toBe(false);
    expect(referenceQueryPolicy.staleTime).toBeGreaterThanOrEqual(60_000);
    expect(operationalQueryClientDefaults.queries.staleTime).toBeGreaterThan(0);
  });

  it('keeps the authoritative transaction window short', () => {
    expect(transactionQueryPolicy.staleTime).toBeLessThanOrEqual(30_000);
    expect(transactionQueryPolicy.staleTime).toBeLessThan(referenceQueryPolicy.staleTime);
  });

  it('polls only the live operational signals, and not faster than before', () => {
    expect(liveQueryPolicy.refetchOnWindowFocus).toBe(true);
    expect(QUEUE_REFRESH_INTERVAL_MS).toBeGreaterThanOrEqual(5_000);
    expect(NOTIFICATION_REFRESH_INTERVAL_MS).toBeGreaterThanOrEqual(QUEUE_REFRESH_INTERVAL_MS);
  });

  it('keeps answers in memory long enough to survive a round trip between pages', () => {
    for (const policy of [
      referenceQueryPolicy,
      transactionQueryPolicy,
      historyQueryPolicy,
      liveQueryPolicy,
    ])
      expect(policy.gcTime).toBeGreaterThan(policy.staleTime);
  });
});
