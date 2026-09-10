import { LayoutGrid, Rows3 } from 'lucide-react';

import type { OperationalNavigationSection } from '../operational/operational-navigation';

export const posOperationalNavigation = [
  {
    label: 'Point of Sale',
    items: [
      { to: '/sell', label: 'Sell', icon: LayoutGrid },
      { to: '/open-sales', label: 'Open Sales', icon: Rows3 },
    ],
  },
] as const satisfies readonly OperationalNavigationSection[];
