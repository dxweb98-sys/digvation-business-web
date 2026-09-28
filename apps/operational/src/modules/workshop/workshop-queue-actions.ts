import type { WorkshopWorkOrderStatus } from './workshop-queue-api';

export type WorkshopQueueAction = 'pause' | 'resume' | 'complete' | 'cancel';

/**
 * Pure state+permission -> action mapping. Runtime remains the final
 * authority on whether a transition actually succeeds; this only decides
 * which command buttons are worth presenting. `start` (ASSIGNED ->
 * IN_PROGRESS) is intentionally absent — see workshop-queue-api.ts.
 */
export function availableWorkshopQueueActions(
  status: WorkshopWorkOrderStatus,
  permissions: readonly string[],
): WorkshopQueueAction[] {
  const has = (permission: string) => permissions.includes(permission);

  switch (status) {
    case 'IN_PROGRESS': {
      const actions: WorkshopQueueAction[] = [];
      if (has('workshop-execution:update')) actions.push('pause');
      if (has('work-orders:complete')) actions.push('complete');
      if (has('work-orders:cancel')) actions.push('cancel');
      return actions;
    }
    case 'PAUSED': {
      const actions: WorkshopQueueAction[] = [];
      if (has('workshop-execution:update')) actions.push('resume');
      if (has('work-orders:cancel')) actions.push('cancel');
      return actions;
    }
    case 'WAITING':
    case 'ASSIGNED':
      return has('work-orders:cancel') ? ['cancel'] : [];
    case 'DONE':
    case 'CANCELLED':
      return [];
    default:
      return [];
  }
}

export function canReadWorkshopQueue(permissions: readonly string[]): boolean {
  return permissions.includes('workshop-queue:read');
}
