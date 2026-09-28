export function canCreateWorkshopCustomer(permissions: readonly string[]) {
  return permissions.includes('customers:manage');
}

export function newIdempotencyKey(): string {
  return `workshop-work-order:${crypto.randomUUID()}`;
}

export function apiErrorCode(error: unknown): string | undefined {
  const value = error as { code?: string; body?: { error?: { code?: string } } } | undefined;
  return value?.code ?? value?.body?.error?.code;
}

export const INTAKE_ERROR_COPY: Record<string, string> = {
  WORKSHOP_CUSTOMER_NOT_FOUND: 'Customer was not found. Search again.',
  WORKSHOP_CUSTOMER_INACTIVE: 'This Customer is not active.',
  WORKSHOP_VEHICLE_NOT_FOUND: 'Vehicle was not found. Search again.',
  WORKSHOP_VEHICLE_CUSTOMER_MISMATCH: 'This Vehicle belongs to a different Customer.',
  WORKSHOP_VEHICLE_DUPLICATE_PLATE: 'A Vehicle with this plate number already exists.',
  WORKSHOP_VEHICLE_DUPLICATE_CHASSIS: 'A Vehicle with this chassis number already exists.',
  WORKSHOP_VEHICLE_DUPLICATE_ENGINE: 'A Vehicle with this engine number already exists.',
  WORKSHOP_VEHICLE_INPUT_INVALID: 'Check the Vehicle details and try again.',
  OPERATIONAL_LOCATION_ACCESS_DENIED: 'This Location is not available to you.',
  IDEMPOTENCY_KEY_REQUIRED: 'Could not submit. Try again.',
};
