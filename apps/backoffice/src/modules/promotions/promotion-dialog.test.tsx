import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../app/localization/backoffice-localization-base';
import { PromotionDialog } from './promotion-dialog';
import type { Promotion, PromotionsApi } from './promotions-api';

vi.mock('../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({ status: 'authenticated', session: null }),
  isSessionExpiredError: () => false,
}));

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'test' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const memberPromotion: Promotion = {
  id: 'promo-1',
  name: 'Member Weekend',
  enabled: true,
  mode: 'AUTOMATIC',
  code: null,
  scope: 'TRANSACTION',
  audience: 'MEMBERS_ONLY',
  discountType: 'PERCENTAGE',
  discountValue: '0.1',
  currency: 'IDR',
  maximumDiscount: null,
  minimumPurchase: null,
  effectiveFrom: null,
  effectiveUntil: null,
  version: 2,
  itemIds: [],
  variantIds: [],
  categoryIds: [],
  locationIds: [],
  status: 'ACTIVE',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

function renderDialog(promotion: Promotion | null, membershipAvailable: boolean) {
  const api = {
    create: vi.fn(async () => memberPromotion),
    update: vi.fn(async () => memberPromotion),
  };
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <DToastProvider>
          <PromotionDialog
            promotion={promotion}
            options={{ items: [], variants: [], categories: [], locations: [] }}
            api={api as unknown as PromotionsApi}
            membershipAvailable={membershipAvailable}
            onClose={vi.fn()}
            onChanged={vi.fn()}
          />
        </DToastProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
  return { api, dialog: within(screen.getByRole('dialog')) };
}

const audienceSelect = (dialog: ReturnType<typeof within>) =>
  dialog.getByRole('button', { name: /Target pelanggan/ });
const openAudience = (dialog: ReturnType<typeof within>) => fireEvent.click(audienceSelect(dialog));
const fillRequired = (dialog: ReturnType<typeof within>) => {
  fireEvent.change(dialog.getByLabelText('Nama'), { target: { value: 'Diskon Member' } });
  fireEvent.change(dialog.getByLabelText('Nilai diskon'), { target: { value: '10' } });
};

afterEach(cleanup);

describe('Promotion audience field', () => {
  it('defaults a new promotion to all customers', async () => {
    const { api, dialog } = renderDialog(null, true);

    expect(audienceSelect(dialog).textContent).toContain('Semua pelanggan');
    expect(dialog.getByText('Berlaku untuk semua transaksi yang memenuhi syarat.')).toBeTruthy();
    fillRequired(dialog);
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ audience: 'ALL' }));
  });

  it('creates a member-only promotion when Membership is available', async () => {
    const { api, dialog } = renderDialog(null, true);

    openAudience(dialog);
    fireEvent.click(await screen.findByRole('option', { name: 'Khusus Member' }));
    expect(
      dialog.getByText('Promo hanya diterapkan jika transaksi memiliki pelanggan member aktif.'),
    ).toBeTruthy();
    fillRequired(dialog);
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        expect.objectContaining({ audience: 'MEMBERS_ONLY' }),
      ),
    );
  });

  it('does not offer member-only without Membership', async () => {
    const { dialog } = renderDialog(null, false);

    expect(dialog.getByText('Aktifkan Membership untuk membuat promo khusus member.')).toBeTruthy();
    openAudience(dialog);
    const option = await screen.findByRole('option', { name: 'Khusus Member' });
    expect(option.getAttribute('aria-disabled') === 'true' || option.hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.click(option);
    expect(audienceSelect(dialog).textContent).toContain('Semua pelanggan');
  });

  it('edits an existing member-only promotion and keeps its audience', async () => {
    const { api, dialog } = renderDialog(memberPromotion, true);

    expect(audienceSelect(dialog).textContent).toContain('Khusus Member');
    fireEvent.change(dialog.getByLabelText('Nama'), { target: { value: 'Member Sunday' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        memberPromotion,
        expect.objectContaining({ name: 'Member Sunday', audience: 'MEMBERS_ONLY' }),
      ),
    );
  });

  it('warns and leaves the audience to Runtime when Membership was turned off', async () => {
    const { api, dialog } = renderDialog(memberPromotion, false);

    expect(
      dialog.getByText(
        'Membership tidak aktif untuk bisnis ini, sehingga promo khusus member ini tidak akan berlaku.',
      ),
    ).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    const [, input] = api.update.mock.calls[0] as unknown as [Promotion, Record<string, unknown>];
    expect('audience' in input).toBe(false);
  });
});
