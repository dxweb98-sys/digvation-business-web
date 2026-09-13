import { ReceiptText } from 'lucide-react';

import type { OperationalNavigationSection } from '../operational/operational-navigation';

export const financeOperationalNavigation = {
  label: 'Operations',
  items: [{ to: '/expenses', label: 'Expenses', icon: ReceiptText }],
} as const satisfies OperationalNavigationSection;
