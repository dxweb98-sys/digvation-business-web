import type {
  CreateEmployeeInput,
  Employee,
  EmployeePosition,
  UpdateEmployeeInput,
} from './employees-api';

export interface EmployeeEditorForm {
  code: string;
  displayName: string;
  positionId: string;
  joinedOn: string;
  servicePerformerEligible: boolean;
  productSalesEligible: boolean;
}

/** Service performing and Product sales attribution are separate eligibilities on one Employee. */
export function employeeEditorForm(employee: Employee | null | undefined): EmployeeEditorForm {
  return {
    code: employee?.code ?? '',
    displayName: employee?.displayName ?? '',
    positionId: employee?.positionId ?? '',
    joinedOn: employee?.joinedOn ?? '',
    servicePerformerEligible: employee?.servicePerformerEligible ?? true,
    productSalesEligible: employee?.productSalesEligible ?? false,
  };
}

export function createEmployeePayload(form: EmployeeEditorForm): CreateEmployeeInput {
  return {
    ...(form.code.trim() ? { code: form.code.trim().toUpperCase() } : {}),
    displayName: form.displayName.trim(),
    positionId: form.positionId || null,
    servicePerformerEligible: form.servicePerformerEligible,
    productSalesEligible: form.productSalesEligible,
    ...(form.joinedOn ? { joinedOn: form.joinedOn } : {}),
  };
}

export function updateEmployeePayload(
  employee: Employee,
  form: EmployeeEditorForm,
): UpdateEmployeeInput {
  return {
    displayName: form.displayName.trim(),
    ...(form.positionId !== (employee.positionId ?? '')
      ? { positionId: form.positionId || null }
      : {}),
    joinedOn: form.joinedOn || null,
    ...(form.servicePerformerEligible !== employee.servicePerformerEligible
      ? { servicePerformerEligible: form.servicePerformerEligible }
      : {}),
    ...(form.productSalesEligible !== employee.productSalesEligible
      ? { productSalesEligible: form.productSalesEligible }
      : {}),
  };
}

/** Why an employee is not an effective Service performer; presentation only, never a filter. */
export type ServiceEligibilityBlocker =
  'EMPLOYEE_INACTIVE' | 'OPTED_OUT' | 'NO_POSITION' | 'POSITION_INACTIVE' | 'POSITION_NOT_SERVICE';

interface ServiceEligibilityFacts {
  status: Employee['status'];
  servicePerformerEligible: boolean;
  position: Pick<EmployeePosition, 'status' | 'serviceAssignmentEnabled'> | null | undefined;
}

/**
 * Names the first gate that keeps an employee out of Operational Service performer selection.
 * For saved employees Runtime's canPerformServices is the verdict; this only explains it. For an
 * unsaved draft it previews the same gates so the editor does not promise a result it cannot keep.
 */
export function serviceEligibilityBlocker(
  facts: ServiceEligibilityFacts & { canPerformServices?: boolean },
): ServiceEligibilityBlocker | null {
  if (facts.canPerformServices === true) return null;
  if (facts.status !== 'ACTIVE') return 'EMPLOYEE_INACTIVE';
  if (!facts.servicePerformerEligible) return 'OPTED_OUT';
  if (!facts.position) return 'NO_POSITION';
  if (facts.position.status !== 'ACTIVE') return 'POSITION_INACTIVE';
  if (!facts.position.serviceAssignmentEnabled) return 'POSITION_NOT_SERVICE';
  return null;
}

export const serviceEligibilityBlockerCopy: Record<ServiceEligibilityBlocker, string> = {
  EMPLOYEE_INACTIVE: 'Employee is inactive.',
  OPTED_OUT: 'Not enabled as a Service performer.',
  NO_POSITION: 'No position assigned.',
  POSITION_INACTIVE: 'Position is inactive.',
  POSITION_NOT_SERVICE: 'Position does not allow Service assignment.',
};
