/**
 * Operational cache policy.
 *
 * Every Operational read belongs to exactly one data class, and the class — not
 * the call site — decides how long the answer may be reused, whether changing
 * page refetches it, and whether returning to the tab refetches it.
 *
 * Before this policy each screen decided for itself, and most screens asked for
 * `staleTime: 0` with `refetchOnMount: 'always'`, so every navigation and every
 * tab switch reloaded the catalog, employees, payment routes and access
 * context even though none of them had changed. Only the operational queue and
 * the notification counter are genuinely live, so only they poll.
 *
 * Authority is unchanged: Runtime still owns every value. Commands keep writing
 * the authoritative Sale back into the cache, and invalidation after a mutation
 * still refetches immediately regardless of the stale windows below.
 */

const MINUTE = 60_000;

/**
 * Reference data configured in Backoffice: catalog, variants, employees,
 * payment routes, operational access context. A cashier action never changes
 * it, so it is reused across navigation and tab switches.
 */
export const referenceQueryPolicy = {
  staleTime: 5 * MINUTE,
  gcTime: 30 * MINUTE,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
} as const;

/**
 * The authoritative Sale aggregate of one transaction. Commands return the new
 * version and write it into the cache, so a short stale window is enough to
 * survive navigation without ever showing a stale total for long.
 */
export const transactionQueryPolicy = {
  staleTime: 15_000,
  gcTime: 5 * MINUTE,
  refetchOnWindowFocus: false,
} as const;

/**
 * Captured records read for review, such as expense lists.
 * Paging back and forth reuses what was already loaded.
 */
export const historyQueryPolicy = {
  staleTime: 2 * MINUTE,
  gcTime: 10 * MINUTE,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
} as const;

/**
 * Live operational signals: the queue other cashiers also work on, and the
 * unread notification counter. These poll, but only while the tab is the
 * focused one — React Query pauses `refetchInterval` in the background unless
 * `refetchIntervalInBackground` is set, which is exactly what is wanted here.
 */
export const liveQueryPolicy = {
  staleTime: 5_000,
  gcTime: 5 * MINUTE,
  refetchOnWindowFocus: true,
} as const;

/** Queue refresh cadence while the Operational tab is focused. */
export const QUEUE_REFRESH_INTERVAL_MS = 10_000;

/** Unread notification counter cadence while the Operational tab is focused. */
export const NOTIFICATION_REFRESH_INTERVAL_MS = 60_000;

/**
 * Client-wide defaults. A query that does not opt into a class above still gets
 * a sane reuse window instead of refetching on every mount, and no query
 * refetches merely because the operator came back to the tab.
 */
export const operationalQueryClientDefaults = {
  queries: {
    retry: 1,
    staleTime: MINUTE,
    gcTime: 10 * MINUTE,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  mutations: {
    retry: false,
    networkMode: 'always',
  },
} as const;
