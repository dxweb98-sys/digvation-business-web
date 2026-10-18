import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import type { ReportDataset } from '../api/reporting-api';
import { ReportsPage } from './reports-page';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'test' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

/** The first render loads providers, location context, and the dataset; allow for a busy test run. */
export const LOADED = { timeout: 5000 };

export const ORGANIZATION_WIDE = {
  organizationWide: true,
  resolution: 'AUTO_RESOLVED',
  selectedLocationId: null,
  locations: [{ id: 'location-1', code: 'PUSAT', name: 'Cabang utama' }],
};

export function dataset(
  type: ReportDataset['type'],
  change: Partial<ReportDataset> = {},
): ReportDataset {
  return {
    type,
    summary: {},
    analytics: { trend: [], breakdown: [], breakdowns: {}, ranking: [] },
    items: [],
    total: 0,
    ...change,
  };
}

/** A fake API client: report datasets by type, plus whatever detail paths a test serves. */
export function fakeGet(
  datasets: Partial<Record<ReportDataset['type'], ReportDataset>>,
  extra: Record<string, unknown> = {},
) {
  const requests: string[] = [];
  const get = async (url: string) => {
    requests.push(url);
    const path = url.split('?')[0]!;
    if (path === '/api/v1/operational-access/context') return ORGANIZATION_WIDE;
    const report = /^\/api\/v1\/reports\/([a-z-]+)$/.exec(path)?.[1];
    if (report) return datasets[report as ReportDataset['type']] ?? dataset(report as never);
    if (path in extra) return extra[path];
    return { items: [] };
  };
  return { get, requests };
}

export function renderReports(url: string) {
  window.history.replaceState(null, '', url);
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <DToastProvider>
            <ReportsPage />
          </DToastProvider>
        </QueryClientProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}
