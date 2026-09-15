import { History, LayoutGrid } from 'lucide-react';

import type { OperationalNavigationSection } from '../operational/operational-navigation';

export const posSellOperationalNavigation = {
  label: 'Sales',
  items: [{ to: '/sell', label: 'Sell', icon: LayoutGrid }],
} as const satisfies OperationalNavigationSection;

export const posHistoryOperationalNavigation = {
  label: 'Sales',
  items: [{ to: '/transactions', label: 'Transaction history', icon: History }],
} as const satisfies OperationalNavigationSection;
