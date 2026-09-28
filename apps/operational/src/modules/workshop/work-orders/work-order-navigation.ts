import { ClipboardList } from 'lucide-react';

import type { OperationalNavigationSection } from '../../operational/operational-navigation';

/** Workshop contributes one Operational destination: the Work Order workspace. */
export const workOrderNavigation = {
  label: 'Operations',
  items: [{ to: '/workshop/work-orders', label: 'Work Order', icon: ClipboardList }],
} as const satisfies OperationalNavigationSection;
