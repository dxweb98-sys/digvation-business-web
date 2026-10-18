import { LayoutGrid } from 'lucide-react';

import type { OperationalNavigationSection } from '../../shared/navigation/operational-navigation';

export const posSellOperationalNavigation = {
  label: 'Sales',
  items: [{ to: '/sell', label: 'Sell', icon: LayoutGrid }],
} as const satisfies OperationalNavigationSection;
