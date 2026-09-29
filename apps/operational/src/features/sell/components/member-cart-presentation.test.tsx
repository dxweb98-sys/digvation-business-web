import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { presentDraftMember } from '../cart-draft';
import type { SaleCustomer } from '../cashier-transaction.types';

import { ReferenceCartPanel } from './replatformed-pos-workspace';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

afterEach(cleanup);

const draftMember: SaleCustomer = {
  type: 'MEMBER',
  referenceId: 'customer-1',
  name: '',
  phoneE164: '',
};
const pickedMember = {
  customerId: 'customer-1',
  memberNumber: 'MEMBER-001',
  customer: { name: 'Rina Wijaya', phoneE164: '+6281234567890' },
};

function renderCart(pointBalance: string | null, isLoading: boolean) {
  const customer = presentDraftMember(draftMember, pickedMember, false);
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <ReferenceCartPanel
        lines={[]}
        total="0.0000"
        gross="0.0000"
        discountAmount="0.0000"
        discountLabel="Diskon"
        taxAmount="0.0000"
        taxLabel="Pajak"
        isEstimate
        isTaxPreviewLoading={false}
        isTaxPreviewUnavailable={false}
        locale="id-ID"
        customer={customer}
        memberNumber={pickedMember.memberNumber}
        pointBalance={pointBalance}
        isPointBalanceLoading={isLoading}
        onChooseCustomer={vi.fn()}
        onQuantity={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onCheckout={vi.fn()}
      />
    </DeploymentBootstrapProvider>,
  );
}

describe('local draft cart with a directly picked member', () => {
  it('shows the member name, badge and member number immediately, with balance loading', () => {
    renderCart(null, true);

    expect(screen.getByText('Rina Wijaya')).toBeTruthy();
    expect(screen.getByText('Member')).toBeTruthy();
    expect(screen.getByText('MEMBER-001')).toBeTruthy();
    expect(screen.getByText(/Memuat poin/)).toBeTruthy();
  });

  it('shows the authoritative loyalty balance once loaded', () => {
    renderCart('120.0000', false);

    expect(screen.getByText(/Poin loyalty: 120/)).toBeTruthy();
    expect(screen.queryByText(/Memuat poin/)).toBeNull();
  });
});
