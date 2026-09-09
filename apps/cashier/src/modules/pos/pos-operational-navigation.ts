import { LayoutGrid, Rows3 } from 'lucide-react';

import type { OperationalNavigationItem } from '../operational/operational-navigation';

export const posOperationalNavigation = [
  { to: '/sell', label: 'Sell', icon: LayoutGrid },
  { to: '/open-sales', label: 'Open Sales', icon: Rows3 },
] as const satisfies readonly OperationalNavigationItem[];
