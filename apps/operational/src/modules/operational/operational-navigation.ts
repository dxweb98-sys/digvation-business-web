import type { LucideIcon } from 'lucide-react';

export interface OperationalNavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface OperationalNavigationSection {
  label: string;
  items: readonly OperationalNavigationItem[];
}
