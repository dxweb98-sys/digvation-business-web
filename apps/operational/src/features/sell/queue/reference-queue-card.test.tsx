import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Sale, SaleLine } from '../transaction/model/cashier-transaction.types';
import { ReferenceQueueCard } from './reference-queue-card';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const noop = () => undefined;
const longCustomer = 'Rina Kusumawardhani Putri Pratiwi dari Cabang Balaraja Timur';

const addition = (name: string) =>
  ({ id: `c-${name}`, componentSource: 'SALE_SELECTED', itemNameSnapshot: name }) as NonNullable<
    SaleLine['compositionComponents']
  >[number];

const line = (overrides: Partial<SaleLine> = {}) =>
  ({
    id: 'line-1',
    removedAt: null,
    itemNameSnapshot: 'Potong Rambut',
    variantNameSnapshot: 'Panjang',
    quantity: '1.0000',
    fulfillmentBehaviorSnapshot: 'TRACKED',
    participations: [
      {
        saleId: 'sale-1',
        saleLineId: 'line-1',
        employeeId: 'emp-andi',
        assigned: true,
        shareRate: null,
      },
      {
        saleId: 'sale-1',
        saleLineId: 'line-1',
        employeeId: 'emp-citra',
        assigned: true,
        shareRate: null,
      },
    ],
    compositionComponents: [addition('Hair Spray'), addition('Pomade')],
    contributions: [],
    discountType: null,
    lineDiscountAmount: '0.0000',
    orderDiscountAllocationAmount: '0.0000',
    overrideAmount: null,
    ...overrides,
  }) as SaleLine;

const sale = (lines: SaleLine[], adjustments: Sale['adjustments'] = []) =>
  ({
    id: 'sale-1',
    saleNumber: 'TRX-20261021-000007',
    status: 'OPEN',
    operationalState: 'QUEUED',
    totalAmount: '290000.0000',
    customer: { type: 'NON_MEMBER', referenceId: null, name: longCustomer, phoneE164: null },
    createdAt: '2026-10-21T03:00:00.000Z',
    updatedAt: '2026-10-21T03:00:00.000Z',
    lines,
    adjustments,
    payments: [],
  }) as unknown as Sale;

function renderCard(value: Sale) {
  const { container } = render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <ReferenceQueueCard
        sale={value}
        status="QUEUED"
        locale="id-ID"
        issues={[]}
        onStartWork={noop}
        onAdjust={noop}
        canAdjust
        onPay={noop}
        onCancel={noop}
        onView={noop}
        onViewReceipt={noop}
        onSendReceipt={noop}
      />
    </DeploymentBootstrapProvider>,
  );
  return within(container);
}

const NOTE = /Diskon item hanya berlaku untuk harga item utama/;

afterEach(cleanup);

describe('compact queue card', () => {
  it('identifies the order: customer, number, main item and how many additions it carries', () => {
    const card = renderCard(sale([line()]));
    expect(card.getByText(longCustomer)).toBeTruthy();
    expect(card.getByText('TRX-20261021-000007')).toBeTruthy();
    expect(card.getByText('Potong Rambut')).toBeTruthy();
    expect(card.getByText(/\+ 2 tambahan/)).toBeTruthy();
  });

  it('leaves performers, addition names and discount notes to the transaction detail', () => {
    const card = renderCard(
      sale([
        line({
          discountType: 'PERCENTAGE',
          lineDiscountAmount: '20000.0000',
          orderDiscountAllocationAmount: '5000.0000',
        }),
      ]),
    );
    expect(card.queryByText(/Hair Spray/)).toBeNull();
    expect(card.queryByText(/emp-andi|Andi/)).toBeNull();
    expect(card.queryByText(NOTE)).toBeNull();
  });

  it('leads with the item that carries additions, whatever order the lines arrive in', () => {
    const card = renderCard(
      sale([
        line({
          id: 'line-product',
          itemNameSnapshot: 'Pomade',
          variantNameSnapshot: null,
          fulfillmentBehaviorSnapshot: 'INSTANT',
          compositionComponents: [],
        }),
        line(),
      ]),
    );
    expect(card.getByText('Potong Rambut')).toBeTruthy();
    expect(card.getByText(/\+ 2 tambahan/)).toBeTruthy();
    expect(card.queryByText('Pomade')).toBeNull();
  });

  it('shows no addition count for an item without additions', () => {
    const card = renderCard(sale([line({ compositionComponents: [] })]));
    expect(card.getByText('Potong Rambut')).toBeTruthy();
    expect(card.queryByText(/tambahan/)).toBeNull();
  });
});
