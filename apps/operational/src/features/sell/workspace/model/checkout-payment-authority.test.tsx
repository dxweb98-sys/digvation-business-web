import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Sale } from '../../transaction/model/cashier-transaction.types';
import { useCashierTransactionWorkspace } from './use-cashier-transaction-workspace';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const line = (id: string, saleId: string, amount: string) => ({
  id,
  saleId,
  catalogItemId: 'smoothing',
  catalogVariantId: null,
  itemNameSnapshot: 'Smoothing Curly',
  quantity: '1.0000',
  resolvedUnitPrice: amount,
  effectiveUnitPrice: amount,
  grossAmount: amount,
  totalAmount: amount,
  lineDiscountAmount: '0.0000',
  removedAt: null,
  fulfillmentBehaviorSnapshot: 'INSTANT',
  fulfillment: null,
  participations: [],
  contributions: [],
  compositionComponents: [],
});

/** The checkout's own Sale: one unpaid item. */
const checkoutSale = {
  id: 'sale-a',
  saleNumber: 'TRX-A',
  status: 'OPEN',
  operationalState: 'UNSUBMITTED',
  version: 2,
  sellingLocationId: 'location-1',
  currency: 'IDR',
  grossAmount: '185000.0000',
  discountAmount: '0.0000',
  taxAmount: '20350.0000',
  totalAmount: '205350.0000',
  customer: { type: 'NON_MEMBER', name: 'Siti Aminah', phoneE164: '+6281234567890' },
  adjustments: [],
  payments: [],
  lines: [line('line-a', 'sale-a', '185000.0000')],
} as unknown as Sale;

/** A different, queued and fully paid Sale left behind as the queue context. */
const queuedSale = {
  ...checkoutSale,
  id: 'sale-b',
  saleNumber: 'TRX-B',
  operationalState: 'QUEUED',
  version: 10,
  grossAmount: '555000.0000',
  taxAmount: '61050.0000',
  totalAmount: '616050.0000',
  payments: [
    { id: 'pay-bca', status: 'SUCCEEDED', method: 'BANK_TRANSFER', appliedAmount: '205350.0000' },
    { id: 'pay-qris', status: 'SUCCEEDED', method: 'QRIS', appliedAmount: '410700.0000' },
  ],
  lines: [line('line-b1', 'sale-b', '185000.0000'), line('line-b2', 'sale-b', '370000.0000')],
} as unknown as Sale;

const sales: Record<string, Sale> = { 'sale-a': checkoutSale, 'sale-b': queuedSale };
const createSalePayment = vi.fn(async (saleId: string) => ({
  ...sales[saleId]!,
  version: sales[saleId]!.version + 1,
}));
const known: Record<string, unknown> = {
  getSale: async (saleId: string) => sales[saleId],
  createSalePayment,
};
/** Every other adapter read answers empty; this test only exercises Sale selection. */
const adapter = new Proxy(known, {
  get: (target, name: string) =>
    name in target ? target[name] : async () => ({ items: [], limit: 100, offset: 0 }),
});

vi.mock('../../transaction/api/cashier-transaction-adapter-factory', () => ({
  createCashierTransactionAdapter: () => adapter,
  isLocalCashierDemoEnabled: () => false,
}));
vi.mock('../../session/cashier-session-provider', () => ({
  useCashierSession: () => ({
    selectedLocationId: 'location-1',
    selectLocation: vi.fn(),
    rememberSale: vi.fn(),
  }),
}));
vi.mock('@digvation/pos-auth', () => ({ useAuth: () => ({ authPort: {} }) }));
vi.mock('@digvation/pos-runtime', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRuntime: () => ({ apiBaseUrl: '', locale: 'id-ID', currency: 'IDR' }),
  useConnectivity: () => ({ state: 'ONLINE' }),
}));

type Workspace = ReturnType<typeof useCashierTransactionWorkspace>;

function setup() {
  let current!: Workspace;
  function Probe() {
    current = useCashierTransactionWorkspace('sale-a');
    return null;
  }
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/sell/sale-a']}>
          <Probe />
        </MemoryRouter>
      </QueryClientProvider>
    </DeploymentBootstrapProvider>,
  );
  return () => current;
}

afterEach(cleanup);

describe('one Sale authority per payment mode', () => {
  it('keeps every checkout figure and the payment write on the checkout Sale while a queued Sale is the queue context', async () => {
    const workspace = setup();
    await waitFor(() => expect(workspace().viewModel.sale?.id).toBe('sale-a'));

    await act(async () => workspace().openQueueContext('sale-b'));
    await waitFor(() => expect(workspace().queueContextSale?.id).toBe('sale-b'));

    // The checkout dialog's identity, progress and payment rows (`viewModel.sale`) and its lines
    // and totals (`cart`) describe the same Sale: A, never the queued B.
    const { viewModel, cart } = workspace();
    expect(viewModel.sale?.id).toBe('sale-a');
    expect(viewModel.sale?.totalAmount).toBe('205350.0000');
    expect(viewModel.sale?.payments).toEqual([]);
    expect(viewModel.availableToPay).toBe('205350.0000');
    expect(cart.totalAmount).toBe('205350.0000');
    expect(cart.taxAmount).toBe('20350.0000');
    expect(cart.lines.map((entry) => entry.id)).toEqual(['line-a']);

    // What the operator pays is recorded on the Sale they see.
    await act(async () => {
      await workspace().createPayment('CASH', '205350.0000', '205350.0000');
    });
    expect(createSalePayment).toHaveBeenCalledTimes(1);
    expect(createSalePayment.mock.calls[0]![0]).toBe('sale-a');
  });

  it('gives a queue dialog the queued Sale it selected, never the checkout Sale', async () => {
    const workspace = setup();
    await waitFor(() => expect(workspace().viewModel.sale?.id).toBe('sale-a'));
    await act(async () => workspace().openQueueContext('sale-b'));
    await waitFor(() => expect(workspace().queueContextSale?.id).toBe('sale-b'));
    expect(workspace().queueContextSale?.totalAmount).toBe('616050.0000');
    expect(workspace().queueContextSale?.payments).toHaveLength(2);

    act(() => workspace().closeQueueContext());
    expect(workspace().queueContextSale).toBeNull();
    expect(workspace().viewModel.sale?.id).toBe('sale-a');
  });
});
