import { describe, expect, it } from 'vitest';

import {
  availableDashboardWidgets,
  DEFAULT_DASHBOARD_WIDGETS,
} from './dashboard-widget-registry';

describe('dashboard widget registry', () => {
  it('keeps optional widget defaults independent from entitlement authority', () => {
    expect(DEFAULT_DASHBOARD_WIDGETS).toEqual([
      'salesTrend',
      'paymentMix',
      'topItems',
      'topEmployees',
      'locationPerformance',
      'businessInsight',
    ]);
  });

  it('only exposes widgets backed by the current user permissions', () => {
    expect(
      availableDashboardWidgets(['sales:read']).map(({ id }) => id),
    ).toEqual([
      'salesTrend',
      'paymentMix',
      'locationPerformance',
      'businessInsight',
    ]);

    expect(
      availableDashboardWidgets([
        'sales:read',
        'catalog:read',
        'employees:read',
      ]).map(({ id }) => id),
    ).toEqual([
      'salesTrend',
      'paymentMix',
      'topItems',
      'topEmployees',
      'locationPerformance',
      'businessInsight',
    ]);
  });
});
