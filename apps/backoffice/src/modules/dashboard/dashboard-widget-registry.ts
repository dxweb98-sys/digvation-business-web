import type { DashboardWidgetId } from './dashboard.types';

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  label: string;
  description: string;
  permission: string;
}

export const DASHBOARD_WIDGETS: readonly DashboardWidgetDefinition[] = [
  {
    id: 'businessPerformance',
    label: 'Transaction activity',
    description: 'Revenue and transaction movement with its own period selector.',
    permission: 'sales:read',
  },
  {
    id: 'lastTransactions',
    label: 'Last transactions',
    description: 'Compact list of the latest transactions for the selected branch.',
    permission: 'sales:read',
  },
  {
    id: 'topItems',
    label: 'Top 5 items',
    description: 'Best-performing catalog items for the current month.',
    permission: 'catalog:read',
  },
  {
    id: 'topEmployees',
    label: 'Top 5 employees',
    description: 'Highest employee contribution for the current month.',
    permission: 'employees:read',
  },
  {
    id: 'paymentMix',
    label: 'Payment mix',
    description: 'Compact payment-method composition for the current month.',
    permission: 'sales:read',
  },
  {
    id: 'locationPerformance',
    label: 'Location performance',
    description: 'Current-month revenue comparison between available locations.',
    permission: 'locations:read',
  },
  {
    id: 'businessInsight',
    label: 'Business insight',
    description: 'Low-cost deterministic insight from this month and the previous month.',
    permission: 'sales:read',
  },
] as const;

export const DEFAULT_DASHBOARD_WIDGETS: readonly DashboardWidgetId[] = [
  'businessPerformance',
  'topItems',
  'topEmployees',
  'businessInsight',
];

export function availableDashboardWidgets(
  permissions: readonly string[],
): DashboardWidgetDefinition[] {
  return DASHBOARD_WIDGETS.filter(({ permission }) =>
    permissions.includes(permission),
  );
}
