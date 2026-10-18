import { useAuth, type AuthSession } from '@digvation/business-auth';

export type OperationalAvailability = AuthSession['access'];

/**
 * Transitional compatibility helper for Operational consumers that have not
 * yet moved to session.access directly. It owns no state and performs no
 * network request; Runtime's authenticated session context remains canonical.
 */
export function useOperationalAvailability(): OperationalAvailability {
  return useAuth().session.access;
}

export function hasOperationalPermission(
  availability: OperationalAvailability,
  permission: string,
): boolean {
  return availability.permissions.includes(permission);
}
