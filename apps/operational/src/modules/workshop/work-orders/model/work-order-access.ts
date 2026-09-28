import { canReadWorkshopQueue } from './workshop-queue-actions';

/**
 * Creating a Work Order needs canonical Customer lookup (`customers:read`) in
 * addition to `work-orders:create`. POS entitlement or permissions are never
 * required: a WORKSHOP-only entitled user must be able to create.
 */
export function canCreateWorkOrder(permissions: readonly string[]): boolean {
  return permissions.includes('work-orders:create') && permissions.includes('customers:read');
}

/** Listing and detail are independent of creating: a user can read without creating, and vice versa. */
export function canReadWorkOrders(permissions: readonly string[]): boolean {
  return canReadWorkshopQueue(permissions);
}

/** The single Work Order workspace is reachable by anyone who can read or create Work Orders. */
export function canAccessWorkOrderWorkspace(
  permissions: readonly string[],
  hasWorkshop: boolean,
): boolean {
  return hasWorkshop && (canReadWorkOrders(permissions) || canCreateWorkOrder(permissions));
}
