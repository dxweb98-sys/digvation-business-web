import { LayoutGrid } from 'lucide-react';

import type { OperationalNavigationSection } from '../operational/operational-navigation';

export const posOperationalNavigation = [
  {
    label: 'Sales',
    items: [{ to: '/sell', label: 'Sell', icon: LayoutGrid }],
  },
] as const satisfies readonly OperationalNavigationSection[];
