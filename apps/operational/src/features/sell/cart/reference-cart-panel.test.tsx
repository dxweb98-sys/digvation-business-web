import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CatalogItem, ResolvedPrice } from '../transaction/model/cashier-transaction.types';
import { addCartDraftSelection, cartDraftDisplayLines, emptyCartDraft } from './cart-draft';
import { ReferenceCartPanel } from './reference-cart-panel';

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

const lines = cartDraftDisplayLines(
  addCartDraftSelection(emptyCartDraft('location-1', 'IDR'), item, null, price),
);

function renderPanel(
  onCheckout: () => void,
  isCheckoutPreparing?: boolean,
  pricing: Partial<ComponentProps<typeof ReferenceCartPanel>> = {},
) {
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <ReferenceCartPanel
        lines={lines}
        total="12500.0000"
        gross="12500.0000"
        discountAmount="0.0000"
        discountLabel="Diskon"
        taxAmount="0.0000"
        taxLabel="Pajak"
        isEstimate
        isTaxPreviewLoading={false}
        isTaxPreviewUnavailable={false}
        locale="id-ID"
        customer={null}
        memberNumber={null}
        pointBalance={null}
        isPointBalanceLoading={false}
        onChooseCustomer={vi.fn()}
        onQuantity={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onCheckout={onCheckout}
        {...(isCheckoutPreparing === undefined ? {} : { isCheckoutPreparing })}
        {...pricing}
      />
    </DeploymentBootstrapProvider>,
  );
}

afterEach(cleanup);

describe('ReferenceCartPanel checkout button', () => {
  it('is busy and cannot be pressed again while checkout is being prepared', () => {
    const onCheckout = vi.fn();
    renderPanel(onCheckout, true);
    const checkout = screen.getByRole('button', { name: /Pembayaran/ });

    expect(checkout.getAttribute('aria-busy')).toBe('true');
    expect(checkout.hasAttribute('disabled')).toBe(true);
    fireEvent.click(checkout);
    expect(onCheckout).not.toHaveBeenCalled();
    // The cart itself stays visible and correct while preparing.
    expect(screen.getByText('Item one')).toBeTruthy();
  });

  it('is actionable when nothing is being prepared', () => {
    const onCheckout = vi.fn();
    renderPanel(onCheckout);
    const checkout = screen.getByRole('button', { name: /Pembayaran/ });

    expect(checkout.getAttribute('aria-busy')).toBeNull();
    fireEvent.click(checkout);
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });
});

describe('ReferenceCartPanel pricing preview', () => {
  const helper = /Pajak dan promo dihitung saat transaksi dibuat/;

  it('shows each applicable Promotion before checkout and drops the pending-pricing note', () => {
    renderPanel(vi.fn(), false, {
      gross: '87000.0000',
      discountAmount: '10000.0000',
      discountRows: [{ key: 'p-member', label: 'Promo Member', amount: '10000.0000' }],
      taxLabel: 'Pajak (11%)',
      taxAmount: '8470.0000',
      total: '85470.0000',
      isPricingPreviewed: true,
    });

    expect(screen.getByText('Promo Member')).toBeTruthy();
    expect(screen.getByText(/−\s?Rp\s?10[.,]000/)).toBeTruthy();
    expect(screen.getByText('Pajak (11%)')).toBeTruthy();
    expect(screen.getByText(/Rp\s?85[.,]470/)).toBeTruthy();
    expect(screen.getByText('Estimasi total')).toBeTruthy();
    expect(screen.queryByText(helper)).toBeNull();
    expect(screen.getByRole('button', { name: /Pembayaran/ }).hasAttribute('disabled')).toBe(false);
  });

  it('shows no Promotion row when Runtime applies none', () => {
    renderPanel(vi.fn(), false, { discountRows: [], isPricingPreviewed: true });
    expect(screen.queryByText(/^−/)).toBeNull();
  });

  it('keeps the pending-pricing note while only the local estimate is shown', () => {
    renderPanel(vi.fn());
    expect(screen.getByText(helper)).toBeTruthy();
  });
});
