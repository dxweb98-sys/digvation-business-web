import type { DashboardWidgetId } from './dashboard.types';

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  label: string;
  description: string;
  permission: string;
}

export const DASHBOARD_WIDGETS: readonly DashboardWidgetDefinition[] = [
  {
    id: 'salesTrend',
    label: 'Sales trend',
    description: 'Revenue movement across the selected period.',
    permission: 'sales:read',
  },
  {
    id: 'paymentMix',
    label: 'Payment mix',
    description: 'How completed payments are distributed by payment method.',
    permission: 'sales:read',
  },
  {
    id: 'topItems',
    label: 'Top 5 items',
    description: 'Best-performing catalog items by final revenue.',
    permission: 'catalog:read',
  },
  {
    id: 'topEmployees',
    label: 'Top 5 employees',
    description: 'Highest employee contribution for the selected period.',
    permission: 'employees:read',
  },
  {
    id: 'locationPerformance',
    label: 'Location performance',
    description: 'Revenue comparison between available selling locations.',
    permission: 'locations:read',
  },
  {
    id: 'businessInsight',
    label: 'Business insight',
    description: 'Low-cost deterministic insight from current and previous periods.',
    permission: 'sales:read',
  },
] as const;

export const DEFAULT_DASHBOARD_WIDGETS = DASHBOARD_WIDGETS.map(
  ({ id }) => id,
);

export function availableDashboardWidgets(
  permissions: readonly string[],
): DashboardWidgetDefinition[] {
  return DASHBOARD_WIDGETS.filter(({ permission }) =>
    permissions.includes(permission),
  );
}
