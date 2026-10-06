import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReferenceQueueCard } from './replatformed-pos-workspace';
import type { Sale } from '../../transaction/model/cashier-transaction.types';
import { canAdjustOrder } from '../../adjustment/sale-adjustment-access';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const queuedSale = (operationalState: 'QUEUED' | 'IN_PROGRESS') =>
  ({
    id: 'sale-1',
    saleNumber: 'TRX-20260929-000001',
    currency: 'IDR',
    status: 'OPEN',
    operationalState,
    version: 4,
    totalAmount: '100000.0000',
    grossAmount: '100000.0000',
    discountAmount: '0.0000',
    taxAmount: '0.0000',
    netPreTaxAmount: '100000.0000',
    createdAt: '2026-09-29T03:00:00.000Z',
    customer: { type: 'NON_MEMBER', referenceId: null, name: 'Rina', phoneE164: '+628123456789' },
    payments: [],
    lines: [],
  }) as unknown as Sale;

afterEach(cleanup);

function menuOf(sale: Sale, status: 'QUEUED' | 'PROGRESS', permissions: string[]) {
  const noop = vi.fn();
  const { container } = render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <ReferenceQueueCard
        sale={sale}
        status={status}
        locale="id-ID"
        issues={[]}
        onStartWork={noop}
        onAdjust={noop}
        canAdjust={canAdjustOrder(sale, permissions)}
        onPay={noop}
        onCancel={noop}
        onView={noop}
        onViewReceipt={noop}
        onSendReceipt={noop}
      />
    </DeploymentBootstrapProvider>,
  );
  fireEvent.click(within(container).getByRole('button', { name: /TRX-20260929-000001/ }));
  return within(document.body);
}

describe('queue card Adjust Order gating', () => {
  it('QUEUED keeps the action under the existing rules', () => {
    const menu = menuOf(queuedSale('QUEUED'), 'QUEUED', ['sales:update']);
    expect(menu.getByRole('menuitem', { name: /Sesuaikan pesanan/ })).not.toBeNull();
  });

  it('IN_PROGRESS with only sales:update offers no Adjust Order action', () => {
    const menu = menuOf(queuedSale('IN_PROGRESS'), 'PROGRESS', ['sales:update']);
    expect(menu.queryByRole('menuitem', { name: /Sesuaikan pesanan/ })).toBeNull();
  });

  it('IN_PROGRESS with both permissions offers Adjust Order', () => {
    const menu = menuOf(queuedSale('IN_PROGRESS'), 'PROGRESS', [
      'sales:update',
      'sales:adjust-progressed',
    ]);
    expect(menu.getByRole('menuitem', { name: /Sesuaikan pesanan/ })).not.toBeNull();
  });

  it('leaves the unrelated queue actions unchanged either way', () => {
    const menu = menuOf(queuedSale('IN_PROGRESS'), 'PROGRESS', ['sales:update']);
    expect(menu.getByRole('menuitem', { name: /Lihat detail|Preview/ })).not.toBeNull();
    expect(menu.getByRole('menuitem', { name: /Bayar/ })).not.toBeNull();
    expect(menu.getByRole('menuitem', { name: /Batal/ })).not.toBeNull();
  });
});
