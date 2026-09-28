import { ClipboardList, ListChecks } from 'lucide-react';

import type { OperationalNavigationSection } from '../operational/operational-navigation';

export const workshopOperationalNavigation = {
  label: 'Workshop',
  items: [
    { to: '/workshop/intake', label: 'Intake', icon: ClipboardList },
    { to: '/workshop/queue', label: 'Queue', icon: ListChecks },
  ],
} as const satisfies OperationalNavigationSection;
