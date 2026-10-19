import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import type {
  FinancialAccount,
  FinancialAccountsApi,
  FinancialAccountType,
  PaymentRoute,
  FinancialAccountStatement,
  FinancialAccountStatementMovement,
  SellingLocation,
} from '../api/financial-accounts-api';

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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <QueryClientProvider client={client}>
          <DToastProvider>{ui}</DToastProvider>
        </QueryClientProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}

export function testAccount(
  type: FinancialAccountType,
  change: Partial<FinancialAccount> = {},
): FinancialAccount {
  return {
    id: `${type.toLowerCase()}-account`,
    code: `${type}_MAIN`,
    name: `Akun ${type}`,
    type,
    currency: 'IDR',
    institutionName: type === 'CASH' ? null : 'BCA',
    accountReference: type === 'CASH' ? null : 'ID1023456789',
    accountHolderName: type === 'CASH' ? null : 'Toko Maju',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...change,
  };
}

export function testRoute(change: Partial<PaymentRoute> = {}): PaymentRoute {
  return {
    id: 'route-1',
    sellingLocationId: 'location-1',
    sellingLocationCode: 'PUSAT',
    sellingLocationName: 'Toko Pusat',
    paymentMethod: 'QRIS',
    currency: 'IDR',
    financialAccountId: 'qris-account',
    financialAccountCode: 'QRIS_MAIN',
    financialAccountName: 'Akun QRIS',
    financialAccountType: 'QRIS',
    status: 'ACTIVE',
    version: 2,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...change,
  };
}

export function testMovement(
  change: Partial<FinancialAccountStatementMovement> = {},
): FinancialAccountStatementMovement {
  return {
    id: 'movement-1',
    source: 'PAYMENT',
    direction: 'IN',
    amount: '205350.0000',
    currency: 'IDR',
    occurredAt: '2026-10-01T00:00:00.000Z',
    nature: 'FUNDS_MOVEMENT',
    sourceId: 'payment-1',
    accountId: 'cash-account',
    sellingLocationId: 'location-1',
    ...change,
  };
}

/** Opens the action menu of the table row showing `text` and picks `action`. */
export async function clickRowAction(text: string, action: string) {
  const row = (await screen.findAllByText(text))
    .map((node) => node.closest('tr'))
    .find((node): node is HTMLTableRowElement => Boolean(node));
  fireEvent.click(row!.querySelector('[data-ds-component="dropdown-trigger"] > *')!);
  fireEvent.click((await screen.findAllByText(action)).at(-1)!);
}

const page = <T,>(items: T[]) => ({ items, limit: 20, offset: 0, total: items.length });

/** In-memory stand-in for the Financial Accounts transport. */
export function fakeFinancialAccountsApi({
  accounts = [] as FinancialAccount[],
  routes = [] as PaymentRoute[],
  locations = [
    { id: 'location-1', code: 'PUSAT', name: 'Toko Pusat', status: 'ACTIVE', version: 1 },
  ] as SellingLocation[],
} = {}) {
  return {
    listAccounts: vi.fn<FinancialAccountsApi['listAccounts']>(async () => page(accounts)),
    createAccount: vi.fn(async (input: Partial<FinancialAccount>) =>
      testAccount(input.type ?? 'CASH', { ...input, code: input.code ?? 'ACC-000001' }),
    ),
    updateAccount: vi.fn(async (account: FinancialAccount, input: Partial<FinancialAccount>) => ({
      ...account,
      ...input,
      version: account.version + 1,
    })),
    getStatement: vi.fn<FinancialAccountsApi['getStatement']>(
      async (accountId) =>
        ({
          account: accounts.find((account) => account.id === accountId) ?? testAccount('CASH'),
          openingBalanceAvailable: false,
          openingRecordedNetMovement: '0.0000',
          totalIncoming: '0.0000',
          totalOutgoing: '0.0000',
          closingRecordedNetMovement: '0.0000',
          items: [],
          total: 0,
          limit: 25,
          offset: 0,
        }) satisfies FinancialAccountStatement,
    ),
    listRoutes: vi.fn<FinancialAccountsApi['listRoutes']>(async () => page(routes)),
    createRoute: vi.fn(async () => testRoute()),
    updateRoute: vi.fn(async () => testRoute()),
    listLocations: vi.fn(async () => page(locations)),
  };
}
