import { Users } from 'lucide-react';

export function canReadOperationalCustomers(
  permissions: readonly string[],
  foundations: readonly string[],
) {
  return foundations.includes('CUSTOMER_IDENTITY') && permissions.includes('customers:read');
}

export function canReadCustomerMembership(
  permissions: readonly string[],
  capabilities: readonly string[],
) {
  return capabilities.includes('MEMBERSHIP') && permissions.includes('membership:read');
}

export const customerOperationalNavigation = {
  label: 'Customers',
  items: [{ to: '/customers', label: 'Customers', icon: Users }],
} as const;
