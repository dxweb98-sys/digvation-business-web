import type { WorkshopWorkOrderStatus } from '../api/workshop-queue-api';

export type WorkshopQueueAction = 'start' | 'pause' | 'resume' | 'complete' | 'cancel';

/**
 * Pure state+permission -> action mapping. Runtime remains the final
 * authority on whether a transition actually succeeds; this only decides
 * which command buttons are worth presenting.
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
    case 'ASSIGNED': {
      const actions: WorkshopQueueAction[] = [];
      if (has('workshop-execution:update')) actions.push('start');
      if (has('work-orders:cancel')) actions.push('cancel');
      return actions;
    }
    case 'WAITING':
      return has('work-orders:cancel') ? ['cancel'] : [];
    case 'DONE':
    case 'CANCELLED':
      return [];
    default:
      return [];
  }
}

/**
 * User-facing copy for the Runtime error codes the queue can present. Keys are
 * the exact codes Runtime returns; Runtime owns the error vocabulary.
 */
export const WORKSHOP_QUEUE_ERROR_COPY: Record<string, string> = {
  WORKSHOP_MECHANIC_BUSY:
    'This mechanic is already working on another Work Order. Pause or finish it first.',
  WORKSHOP_MECHANIC_NOT_ELIGIBLE: 'This mechanic cannot take workshop work right now.',
  WORKSHOP_MECHANIC_ASSIGNMENT_REQUIRED: 'Assign a mechanic before starting this Work Order.',
  WORKSHOP_ASSIGNMENT_STATE_INVALID: 'The mechanic cannot be changed at this stage.',
  WORKSHOP_MECHANIC_ALREADY_ASSIGNED: 'This mechanic already has this Work Order.',
  WORKSHOP_MECHANIC_NOT_FOUND: 'The mechanic was not found.',
  WORKSHOP_WORK_STATUS_TRANSITION_INVALID:
    'This action is no longer available for the current Work Order status.',
  WORKSHOP_CANCELLATION_REASON_REQUIRED: 'Enter a reason to cancel this Work Order.',
};

/**
 * The mechanic can be chosen while WAITING and replaced while ASSIGNED or
 * PAUSED; IN_PROGRESS work keeps its mechanic. Runtime enforces the same rule.
 */
export function mechanicAssignmentMode(
  status: WorkshopWorkOrderStatus,
  permissions: readonly string[],
): 'assign' | 'replace' | null {
  if (!permissions.includes('workshop-assignments:update')) return null;
  if (status === 'WAITING') return 'assign';
  if (status === 'ASSIGNED' || status === 'PAUSED') return 'replace';
  return null;
}

/** Errors that leave the open Work Order valid: its version did not change. */
export const WORKSHOP_KEEP_OPEN_ERROR_CODES: readonly string[] = [
  'WORKSHOP_CANCELLATION_REASON_REQUIRED',
  'WORKSHOP_MECHANIC_BUSY',
  'WORKSHOP_MECHANIC_NOT_ELIGIBLE',
];

export function canReadWorkshopQueue(permissions: readonly string[]): boolean {
  return permissions.includes('workshop-queue:read');
}
