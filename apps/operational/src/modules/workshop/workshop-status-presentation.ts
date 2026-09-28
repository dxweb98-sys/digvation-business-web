import type { WorkshopWorkOrderStatus } from './workshop-queue-api';

/** Shared by the Queue and the Intake recent-Work-Orders list. */
export const STATUS_BADGE_VARIANT: Record<
  WorkshopWorkOrderStatus,
  'outline' | 'success' | 'warning' | 'danger' | 'info'
> = {
  WAITING: 'outline',
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  PAUSED: 'outline',
  DONE: 'success',
  CANCELLED: 'danger',
};
