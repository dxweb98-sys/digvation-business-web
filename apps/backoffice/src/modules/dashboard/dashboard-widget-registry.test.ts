import { describe, expect, it } from 'vitest';

import {
  availableDashboardWidgets,
  DEFAULT_DASHBOARD_WIDGETS,
} from './dashboard-widget-registry';

describe('dashboard widget registry', () => {
  it('keeps the default premium dashboard focused', () => {
    expect(DEFAULT_DASHBOARD_WIDGETS).toEqual([
      'businessPerformance',
      'topItems',
      'topEmployees',
      'businessInsight',
    ]);
  });

  it('only exposes widgets backed by the current user permissions', () => {
    expect(
      availableDashboardWidgets(['sales:read']).map(({ id }) => id),
    ).toEqual([
      'businessPerformance',
      'lastTransactions',
      'paymentMix',
      'businessInsight',
    ]);

    expect(
      availableDashboardWidgets([
        'sales:read',
        'catalog:read',
        'employees:read',
        'locations:read',
      ]).map(({ id }) => id),
    ).toEqual([
      'businessPerformance',
      'lastTransactions',
      'topItems',
      'topEmployees',
      'paymentMix',
      'businessInsight',
    ]);
  });
});
