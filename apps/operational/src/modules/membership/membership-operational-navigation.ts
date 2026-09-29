import { Users } from 'lucide-react';

import type { OperationalNavigationSection } from '../operational/operational-navigation';

export const membershipOperationalNavigation = {
  label: 'Customers',
  items: [{ to: '/members', label: 'Members', icon: Users }],
} as const satisfies OperationalNavigationSection;
