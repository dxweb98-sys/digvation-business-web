import type { CreateEmployeeInput, Employee, UpdateEmployeeInput } from './employees-api';

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
