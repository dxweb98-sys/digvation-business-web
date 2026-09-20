import { describe, expect, it } from 'vitest';

import type { Employee } from './cashier-transaction.types';
import { selectableServicePerformers } from './use-employee-options';

function employee(
  overrides: Partial<Employee> = {},
): Employee {
  return {
    id: 'employee-1',
    code: 'EMP-001',
    displayName: 'Ari',
    positionId: 'position-1',
    position: {
      id: 'position-1',
      code: 'THERAPIST',
      name: 'Therapist',
      serviceAssignmentEnabled: true,
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-09-21T00:00:00.000Z',
      updatedAt: '2026-09-21T00:00:00.000Z',
    },
    servicePerformerEligible: true,
    canPerformServices: true,
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-09-21T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('service performer options', () => {
  it('keeps only employees Runtime marks as selectable service performers', () => {
    expect(
      selectableServicePerformers([
        employee(),
        employee({
          id: 'employee-2',
          servicePerformerEligible: false,
          canPerformServices: false,
        }),
        employee({
          id: 'employee-3',
          canPerformServices: false,
          position: {
            ...employee().position!,
            status: 'INACTIVE',
          },
        }),
      ]).map((candidate) => candidate.id),
    ).toEqual(['employee-1']);
  });
});
