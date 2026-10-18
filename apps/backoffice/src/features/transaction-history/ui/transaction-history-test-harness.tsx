import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import type { Sale, TransactionHistoryApi } from '../api/transaction-history-api';
import { TransactionDetailDialog } from './transaction-detail-dialog';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'test' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

export function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <QueryClientProvider client={queryClient}>
          <DToastProvider>{ui}</DToastProvider>
        </QueryClientProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}

export function renderDetail(
  sale: Sale,
  permissions: { refund: boolean; reverse: boolean; correct?: boolean } = {
    refund: true,
    reverse: true,
  },
  api: Partial<
    Pick<TransactionHistoryApi, 'refundPayment' | 'reverse' | 'correctPayments' | 'paymentRoutes'>
  > = {},
) {
  return renderWithProviders(
    <TransactionDetailDialog
      open
      saleId={sale.id}
      api={{
        get: vi.fn(async () => sale),
        refundPayment: api.refundPayment ?? vi.fn(async () => sale),
        reverse: api.reverse ?? vi.fn(async () => sale),
        ...(api.correctPayments ? { correctPayments: api.correctPayments } : {}),
        ...(api.paymentRoutes ? { paymentRoutes: api.paymentRoutes } : {}),
      }}
      permissions={permissions}
      onClose={() => undefined}
      onChanged={() => undefined}
    />,
  );
}

/** The desktop table row of a transaction (the table also renders mobile cards). */
export const tableRow = (saleNumber: string) =>
  screen
    .getAllByText(saleNumber)
    .map((node) => node.closest('tr'))
    .find((row): row is HTMLTableRowElement => Boolean(row))!;
