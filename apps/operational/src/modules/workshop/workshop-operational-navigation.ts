import { ClipboardList } from 'lucide-react';

import type { OperationalNavigationSection } from '../operational/operational-navigation';

export const workshopOperationalNavigation = {
  label: 'Workshop',
  items: [{ to: '/workshop/intake', label: 'Intake', icon: ClipboardList }],
} as const satisfies OperationalNavigationSection;
