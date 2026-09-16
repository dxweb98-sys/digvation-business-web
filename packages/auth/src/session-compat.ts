import type { AuthSession, LegacyCompatibleAuthSession } from './auth.types';

/**
 * Transitional client-side projection only. All compatibility aliases point to
 * values already present in the canonical authenticated session context.
 */
export function withLegacySessionAliases(session: AuthSession): LegacyCompatibleAuthSession {
  return {
    ...session,
    identity: {
      ...session.identity,
      // Legacy workspace consumers only used this as a storage/session scope.
      // Tenant id is the authenticated business scope and cannot be caller-selected.
      workspace: session.business.tenantId,
      permissions: session.access.permissions,
    },
    effectiveEntitlements: {
      products: session.access.products,
      capabilities: session.access.capabilities,
    },
    effectiveFoundations: session.access.foundations,
    effectivePermissions: session.access.permissions,
  };
}
