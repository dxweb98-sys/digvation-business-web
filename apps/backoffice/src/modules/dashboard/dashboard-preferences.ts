import {
  DEFAULT_DASHBOARD_WIDGETS,
  DASHBOARD_WIDGETS,
} from './dashboard-widget-registry';
import type { DashboardWidgetId } from './dashboard.types';

const known = new Set<DashboardWidgetId>(
  DASHBOARD_WIDGETS.map(({ id }) => id),
);

export function dashboardPreferenceKey(input: {
  workspace: string;
  userId: string;
}): string {
  return `digvation.backoffice.dashboard.widgets.v3:${input.workspace}:${input.userId}`;
}

export function loadDashboardPreferences(key: string): DashboardWidgetId[] {
  if (typeof window === 'undefined') return [...DEFAULT_DASHBOARD_WIDGETS];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    if (!Array.isArray(parsed)) return [...DEFAULT_DASHBOARD_WIDGETS];
    return [
      ...new Set(
        parsed.filter(
          (value): value is DashboardWidgetId =>
            typeof value === 'string' && known.has(value as DashboardWidgetId),
        ),
      ),
    ];
  } catch {
    return [...DEFAULT_DASHBOARD_WIDGETS];
  }
}

export function saveDashboardPreferences(
  key: string,
  widgets: readonly DashboardWidgetId[],
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify([...new Set(widgets)]));
}
