import { describe, expect, it } from 'vitest';

import {
  createEmployeePayload,
  employeeEditorForm,
  serviceEligibilityBlocker,
  updateEmployeePayload,
} from './employee-editor-model';
import type { Employee } from './employees-api';

const employee: Employee = {
  id: 'e1',
  code: 'EMP-1',
  displayName: 'Andi',
  positionId: null,
  position: null,
  servicePerformerEligible: true,
  canPerformServices: false,
  productSalesEligible: false,
  canSellProducts: false,
  joinedOn: null,
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-09-29T00:00:00Z',
  updatedAt: '2026-09-29T00:00:00Z',
};

describe('employee eligibility editor model', () => {
  it('defaults a new employee to Service eligible and not Product-sales eligible', () => {
    expect(employeeEditorForm(null)).toMatchObject({
      servicePerformerEligible: true,
      productSalesEligible: false,
    });
  });

  it('sends both eligibilities independently on create', () => {
    const form = { ...employeeEditorForm(null), displayName: ' Andi ', productSalesEligible: true };
    expect(createEmployeePayload(form)).toMatchObject({
      displayName: 'Andi',
      servicePerformerEligible: true,
      productSalesEligible: true,
    });
    expect(
      createEmployeePayload({
        ...form,
        servicePerformerEligible: false,
        productSalesEligible: false,
      }),
    ).toMatchObject({ servicePerformerEligible: false, productSalesEligible: false });
  });

  it('changing Product sales eligibility does not send Service eligibility', () => {
    const form = { ...employeeEditorForm(employee), productSalesEligible: true };
    const payload = updateEmployeePayload(employee, form);
    expect(payload).toMatchObject({ productSalesEligible: true });
    expect(payload).not.toHaveProperty('servicePerformerEligible');
  });

  it('changing Service eligibility does not send Product sales eligibility', () => {
    const form = { ...employeeEditorForm(employee), servicePerformerEligible: false };
    const payload = updateEmployeePayload(employee, form);
    expect(payload).toMatchObject({ servicePerformerEligible: false });
    expect(payload).not.toHaveProperty('productSalesEligible');
  });

  it('round-trips existing values without inventing eligibility changes', () => {
    const payload = updateEmployeePayload(employee, employeeEditorForm(employee));
    expect(payload).not.toHaveProperty('servicePerformerEligible');
    expect(payload).not.toHaveProperty('productSalesEligible');
  });
});

describe('service eligibility explanation', () => {
  const position = { status: 'ACTIVE' as const, serviceAssignmentEnabled: true };
  const eligible = {
    status: 'ACTIVE' as const,
    servicePerformerEligible: true,
    position,
    canPerformServices: true,
  };

  it('trusts Runtime when it says the employee can perform services', () => {
    expect(serviceEligibilityBlocker(eligible)).toBeNull();
  });

  it('names the gate that keeps an employee out of Service selection', () => {
    const blocked = { ...eligible, canPerformServices: false };
    expect(serviceEligibilityBlocker({ ...blocked, status: 'INACTIVE' })).toBe('EMPLOYEE_INACTIVE');
    expect(serviceEligibilityBlocker({ ...blocked, servicePerformerEligible: false })).toBe(
      'OPTED_OUT',
    );
    expect(serviceEligibilityBlocker({ ...blocked, position: null })).toBe('NO_POSITION');
    expect(
      serviceEligibilityBlocker({ ...blocked, position: { ...position, status: 'INACTIVE' } }),
    ).toBe('POSITION_INACTIVE');
    expect(
      serviceEligibilityBlocker({
        ...blocked,
        position: { ...position, serviceAssignmentEnabled: false },
      }),
    ).toBe('POSITION_NOT_SERVICE');
  });
});
