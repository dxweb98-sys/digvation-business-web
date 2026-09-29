import { describe, expect, it } from 'vitest';

import {
  WORKSHOP_KEEP_OPEN_ERROR_CODES,
  WORKSHOP_QUEUE_ERROR_COPY,
  availableWorkshopQueueActions,
  canReadWorkshopQueue,
  mechanicAssignmentMode,
} from './workshop-queue-actions';

describe('Workshop queue error copy', () => {
  it('is keyed by the Runtime error codes, including the Runtime cancellation-reason code', () => {
    // Runtime rejects a blank cancellation reason with exactly this code.
    expect(WORKSHOP_QUEUE_ERROR_COPY.WORKSHOP_CANCELLATION_REASON_REQUIRED).toBeDefined();
    expect(WORKSHOP_QUEUE_ERROR_COPY.WORKSHOP_WORK_STATUS_TRANSITION_INVALID).toBeDefined();
  });

  it('covers every mechanic conflict Runtime can return without exposing raw codes', () => {
    for (const code of [
      'WORKSHOP_MECHANIC_BUSY',
      'WORKSHOP_MECHANIC_NOT_ELIGIBLE',
      'WORKSHOP_MECHANIC_ASSIGNMENT_REQUIRED',
      'WORKSHOP_ASSIGNMENT_STATE_INVALID',
      'WORKSHOP_MECHANIC_ALREADY_ASSIGNED',
      'WORKSHOP_MECHANIC_NOT_FOUND',
    ])
      expect(WORKSHOP_QUEUE_ERROR_COPY[code]).toMatch(/^[A-Z][a-z]/);
  });

  it('keeps the detail open only for errors that leave the Work Order version valid', () => {
    expect(WORKSHOP_KEEP_OPEN_ERROR_CODES).toContain('WORKSHOP_MECHANIC_BUSY');
    expect(WORKSHOP_KEEP_OPEN_ERROR_CODES).not.toContain('WORKSHOP_WORK_STATUS_TRANSITION_INVALID');
  });

  it('does not keep a code Runtime never returns', () => {
    expect(WORKSHOP_QUEUE_ERROR_COPY).not.toHaveProperty('CANCELLATION_REASON_REQUIRED');
  });
});

describe('Workshop queue action availability', () => {
  it('offers pause/complete/cancel for IN_PROGRESS with matching permissions', () => {
    expect(
      availableWorkshopQueueActions('IN_PROGRESS', [
        'workshop-execution:update',
        'work-orders:complete',
        'work-orders:cancel',
      ]),
    ).toEqual(['pause', 'complete', 'cancel']);
  });

  it('offers only permitted actions for IN_PROGRESS', () => {
    expect(availableWorkshopQueueActions('IN_PROGRESS', ['work-orders:complete'])).toEqual([
      'complete',
    ]);
    expect(availableWorkshopQueueActions('IN_PROGRESS', [])).toEqual([]);
  });

  it('offers resume/cancel for PAUSED with matching permissions', () => {
    expect(
      availableWorkshopQueueActions('PAUSED', ['workshop-execution:update', 'work-orders:cancel']),
    ).toEqual(['resume', 'cancel']);
    expect(availableWorkshopQueueActions('PAUSED', [])).toEqual([]);
  });

  it('offers only cancel for WAITING, never a fake assign action', () => {
    expect(availableWorkshopQueueActions('WAITING', ['work-orders:cancel'])).toEqual(['cancel']);
    expect(availableWorkshopQueueActions('WAITING', ['work-orders:create'])).toEqual([]);
  });

  it('offers start/cancel for ASSIGNED with matching permissions', () => {
    expect(
      availableWorkshopQueueActions('ASSIGNED', ['workshop-execution:update', 'work-orders:cancel']),
    ).toEqual(['start', 'cancel']);
    expect(availableWorkshopQueueActions('ASSIGNED', ['work-orders:cancel'])).toEqual(['cancel']);
    expect(availableWorkshopQueueActions('ASSIGNED', ['workshop-execution:update'])).toEqual([
      'start',
    ]);
  });

  it('offers no mutation actions for terminal states', () => {
    expect(
      availableWorkshopQueueActions('DONE', [
        'workshop-execution:update',
        'work-orders:complete',
        'work-orders:cancel',
      ]),
    ).toEqual([]);
    expect(
      availableWorkshopQueueActions('CANCELLED', [
        'workshop-execution:update',
        'work-orders:complete',
        'work-orders:cancel',
      ]),
    ).toEqual([]);
  });

  it('gates mechanic assignment on workshop-assignments:update and the assignable states', () => {
    const allowed = ['workshop-assignments:update'];
    expect(mechanicAssignmentMode('WAITING', allowed)).toBe('assign');
    expect(mechanicAssignmentMode('ASSIGNED', allowed)).toBe('replace');
    expect(mechanicAssignmentMode('PAUSED', allowed)).toBe('replace');
    expect(mechanicAssignmentMode('IN_PROGRESS', allowed)).toBeNull();
    expect(mechanicAssignmentMode('DONE', allowed)).toBeNull();
    expect(mechanicAssignmentMode('CANCELLED', allowed)).toBeNull();
    expect(mechanicAssignmentMode('WAITING', ['work-orders:update'])).toBeNull();
    expect(mechanicAssignmentMode('ASSIGNED', [])).toBeNull();
  });

  it('gates queue read on workshop-queue:read only', () => {
    expect(canReadWorkshopQueue(['workshop-queue:read'])).toBe(true);
    expect(canReadWorkshopQueue(['work-orders:create'])).toBe(false);
  });
});
