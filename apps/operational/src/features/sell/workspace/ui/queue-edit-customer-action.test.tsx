import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Sale } from '../../transaction/model/cashier-transaction.types';
import { ReferenceQueueCard } from './replatformed-pos-workspace';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const sale = (
  overrides: Partial<{
    status: 'OPEN' | 'FINALIZED';
    operationalState: string;
    customerType: 'NON_MEMBER' | 'MEMBER';
  }> = {},
) =>
  ({
    id: 'sale-1',
    saleNumber: 'TRX-20260929-000001',
    currency: 'IDR',
    status: overrides.status ?? 'OPEN',
    operationalState: overrides.operationalState ?? 'QUEUED',
    version: 4,
    totalAmount: '100000.0000',
    grossAmount: '100000.0000',
    discountAmount: '0.0000',
    taxAmount: '0.0000',
    netPreTaxAmount: '100000.0000',
    createdAt: '2026-09-29T03:00:00.000Z',
    customer: {
      type: overrides.customerType ?? 'NON_MEMBER',
      referenceId: overrides.customerType === 'MEMBER' ? 'member-1' : null,
      name: 'Rina',
      phoneE164: '+628123456789',
    },
    payments: [],
    lines: [],
  }) as unknown as Sale;

afterEach(cleanup);

function menuOf(target: Sale, status: 'QUEUED' | 'PROGRESS' | 'COMPLETED') {
  const noop = vi.fn();
  const onEditCustomer = vi.fn();
  const { container } = render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <ReferenceQueueCard
        sale={target}
        status={status}
        locale="id-ID"
        issues={[]}
        onStartWork={noop}
        onAdjust={noop}
        canAdjust={false}
        onPay={noop}
        onCancel={noop}
        onView={noop}
        onViewReceipt={noop}
        onSendReceipt={noop}
        onEditCustomer={onEditCustomer}
      />
    </DeploymentBootstrapProvider>,
  );
  fireEvent.click(within(container).getByRole('button', { name: /TRX-20260929-000001/ }));
  return { menu: within(document.body), onEditCustomer, target };
}

describe('queue "Edit pelanggan" entry point', () => {
  it.each([
    ['QUEUED', 'QUEUED'],
    ['PROGRESS', 'IN_PROGRESS'],
  ] as const)('is offered for an unfinished walk-in transaction (%s)', (tab, state) => {
    const { menu, onEditCustomer, target } = menuOf(sale({ operationalState: state }), tab);

    fireEvent.click(menu.getByRole('menuitem', { name: /Edit pelanggan/ }));

    expect(onEditCustomer).toHaveBeenCalledWith(target);
  });

  it('is not offered for a Member: the canonical identity is managed in Member management', () => {
    const { menu } = menuOf(sale({ customerType: 'MEMBER' }), 'QUEUED');
    expect(menu.queryByRole('menuitem', { name: /Edit pelanggan/ })).toBeNull();
  });

  it('is not offered once the transaction is completed', () => {
    const { menu } = menuOf(
      sale({ status: 'FINALIZED', operationalState: 'COMPLETED' }),
      'COMPLETED',
    );
    expect(menu.queryByRole('menuitem', { name: /Edit pelanggan/ })).toBeNull();
  });
});
