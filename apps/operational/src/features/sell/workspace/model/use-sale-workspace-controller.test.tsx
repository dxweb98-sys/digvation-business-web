import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  CatalogItem,
  ResolvedPrice,
  Sale,
} from '../../transaction/model/cashier-transaction.types';
import { cashierTransactionKeys } from '../../transaction/api/cashier-transaction-keys';
import type { SaleCommandCoordinator } from './use-sale-command-coordinator';
import { useSaleWorkspaceController } from './use-sale-workspace-controller';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const item: CatalogItem = {
  id: 'item-1',
  code: 'ITEM-1',
  name: 'Item one',
  type: 'PRODUCT',
  categoryId: null,
  description: null,
  lifecycle: 'ACTIVE',
  fulfillmentBehavior: 'INSTANT',
  version: 1,
  createdAt: '2026-09-06T00:00:00.000Z',
  updatedAt: '2026-09-06T00:00:00.000Z',
  serviceDefinition: null,
};

const price: ResolvedPrice = {
  catalogPriceId: 'price-1',
  catalogItemId: item.id,
  catalogVariantId: null,
  locationId: 'location-1',
  currency: 'IDR',
  amount: '12500.0000',
  effectiveAt: '2026-09-06T00:00:00.000Z',
  sourceScope: { catalogVariantId: null, locationId: 'location-1' },
};

const startedSale = {
  id: 'sale-1',
  saleNumber: 'TRX-1',
  status: 'OPEN',
  operationalState: 'UNSUBMITTED',
  version: 1,
  sellingLocationId: 'location-1',
  currency: 'IDR',
  grossAmount: '12500.0000',
  discountAmount: '0.0000',
  taxAmount: '0.0000',
  totalAmount: '12500.0000',
  customer: { type: 'NON_MEMBER', name: 'Siti Aminah', phoneE164: '+6281234567890' },
  adjustments: [],
  payments: [],
  lines: [
    {
      id: 'sale-line-1',
      catalogItemId: item.id,
      catalogVariantId: null,
      itemNameSnapshot: item.name,
      quantity: '1.0000',
      resolvedUnitPrice: '12500.0000',
      effectiveUnitPrice: '12500.0000',
      grossAmount: '12500.0000',
      totalAmount: '12500.0000',
      lineDiscountAmount: '0.0000',
      removedAt: null,
      fulfillmentBehaviorSnapshot: 'INSTANT',
      fulfillment: null,
      participations: [],
      contributions: [],
      compositionComponents: [],
    },
  ],
} as unknown as Sale;

type Controller = ReturnType<typeof useSaleWorkspaceController>;

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const startSale = vi.fn(async () => startedSale);
  const command = {
    runMutation: <T,>(run: () => Promise<T>) => run(),
    commitSale: (sale: Sale) =>
      queryClient.setQueryData(cashierTransactionKeys.sale(sale.id), sale),
    recoverFailure: vi.fn(async () => undefined),
    reportError: vi.fn(),
    clearNotice: vi.fn(),
    refetchSale: vi.fn(),
    effectiveSynchronization: 'CLEAN',
  } as unknown as SaleCommandCoordinator;
  const client = { startSale, getSale: vi.fn(async () => startedSale) } as never;
  const committed: Controller[] = [];
  let current!: Controller;

  function Probe({ routeSaleId }: { routeSaleId?: string }) {
    const controller = useSaleWorkspaceController({
      client,
      command,
      ...(routeSaleId ? { routeSaleId } : {}),
      selectedLocationId: 'location-1',
      currency: 'IDR',
      locale: 'id-ID',
      connectivity: 'ONLINE',
      selectLocation: vi.fn(),
      rememberSale: vi.fn(),
    });
    current = controller;
    useLayoutEffect(() => {
      committed.push(controller);
    });
    return null;
  }
  const tree = (routeSaleId?: string) => (
    <DeploymentBootstrapProvider config={bootstrap}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/sell']}>
          <Probe {...(routeSaleId ? { routeSaleId } : {})} />
        </MemoryRouter>
      </QueryClientProvider>
    </DeploymentBootstrapProvider>
  );
  const view = render(tree());
  return {
    startSale,
    committed,
    controller: () => current,
    deliverRoute: (saleId: string) => view.rerender(tree(saleId)),
  };
}

afterEach(cleanup);

describe('draft to Sale handoff', () => {
  it('keeps the committed draft on screen until the saved Sale replaces it', async () => {
    const { startSale, committed, controller, deliverRoute } = setup();
    await act(async () => {
      await controller().changeCustomer({
        type: 'NON_MEMBER',
        name: 'Siti Aminah',
        phone: '081234567890',
      });
    });
    act(() =>
      controller().addItem(item.id, undefined, {
        catalogItem: item,
        catalogVariant: null,
        resolvedPrice: price,
      }),
    );
    expect(controller().cart.lines).toHaveLength(1);
    const fromDraft = committed.length;

    let sale: Sale | undefined;
    await act(async () => {
      sale = await controller().commitDraft();
    });
    expect(sale?.id).toBe('sale-1');
    // The route has not delivered the Sale yet: the committed draft still fills the cart.
    expect(controller().cart.lines).toHaveLength(1);
    expect(controller().cart.totalAmount).toBe('12500.0000');

    // Checking out again during the handover reuses the Sale instead of starting another one.
    let again: Sale | undefined;
    await act(async () => {
      again = await controller().commitDraft();
    });
    expect(again).toBe(sale);
    expect(startSale).toHaveBeenCalledTimes(1);

    await act(async () => deliverRoute('sale-1'));
    expect(controller().sale?.id).toBe('sale-1');
    expect(controller().cart.isLocalDraft).toBe(false);
    expect(controller().cart.lines.map((line) => line.id)).toEqual(['sale-line-1']);

    const handoff = committed.slice(fromDraft);
    expect(handoff.every((state) => state.cart.lines.length === 1)).toBe(true);
  });
});
