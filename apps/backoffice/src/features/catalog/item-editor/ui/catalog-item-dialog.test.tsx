import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../../app/localization/backoffice-localization-base';
import type { CatalogApi, Item, Variant } from '../../api/catalog-api';
import { CatalogItemDialog } from './catalog-item-dialog';
import type { LoyaltyApi } from '../../../../modules/loyalty/loyalty-api';

vi.mock('../../../../auth/backoffice-auth-context', () => ({
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

const existingItem: Item = {
  id: 'item-1',
  code: 'PRD-1',
  name: 'Kopi',
  type: 'PRODUCT',
  categoryId: null,
  description: null,
  lifecycle: 'ACTIVE',
  fulfillmentBehavior: 'INSTANT',
  variantSelectionMode: 'REQUIRED',
  version: 1,
  serviceDefinition: null,
};

const variant = (id: string, name: string): Variant => ({
  id,
  code: id.toUpperCase(),
  name,
  status: 'ACTIVE',
  version: 1,
  catalogItemId: 'item-1',
});

function fakeApi(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  let created = 0;
  return {
    createItem: vi.fn(async () => existingItem),
    updateItem: vi.fn(async () => existingItem),
    createVariant: vi.fn(async (itemId: string, input: { name: string }) =>
      variant(`v-${++created}`, input.name),
    ),
    createPrice: vi.fn(async () => ({})),
    changePrice: vi.fn(async () => ({})),
    changeVariantPrices: vi.fn(async (input: { amount: string; catalogVariantIds?: string[] }) => ({
      items: input.catalogVariantIds ?? [],
    })),
    listDefaultPrices: vi.fn(async () => ({ items: [] })),
    listVariants: vi.fn(async () => ({ items: [], limit: 50, offset: 0 })),
    resolvePrice: vi.fn(),
    getItemImage: vi.fn(async () => null),
    replaceItemImage: vi.fn(),
    removeItemImage: vi.fn(),
    ...overrides,
  };
}

function fakeLoyaltyApi() {
  return {
    getConfiguration: vi.fn(async () => ({
      configured: true,
      defaultEarningBehavior: 'FIXED' as const,
      defaultFixedPointsPerUnit: 1,
      pointValue: '100.0000',
      currency: 'IDR',
      version: 1,
    })),
    listEarningRules: vi.fn(async () => []),
    updateEarningRule: vi.fn(),
  } as unknown as LoyaltyApi;
}

function renderDialog(
  mocks: ReturnType<typeof fakeApi>,
  item: Item | null,
  loyalty: {
    api?: LoyaltyApi;
    canView?: boolean;
    canConfigure?: boolean;
  } = {},
) {
  const api = mocks as unknown as CatalogApi;
  const onClose = vi.fn();
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <QueryClientProvider client={new QueryClient()}>
          <DToastProvider>
            <CatalogItemDialog
              item={item}
              categories={[]}
              currency="IDR"
              api={api}
              loyaltyApi={loyalty.api ?? ({} as LoyaltyApi)}
              canViewLoyalty={loyalty.canView ?? false}
              canConfigureLoyalty={loyalty.canConfigure ?? false}
              canViewPricing
              canCreatePricing
              canCreateVariants
              canManageImage={false}
              onClose={onClose}
              onSaved={vi.fn()}
            />
          </DToastProvider>
        </QueryClientProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
  return { onClose, dialog: () => screen.getByRole('dialog') };
}

const type = (element: HTMLElement, value: string) =>
  act(() => {
    fireEvent.change(element, { target: { value } });
  });

afterEach(cleanup);

describe('CatalogItemDialog variant pricing', () => {
  it('shows the inherited loyalty rule in Edit Item without mutation controls for a read-only user', async () => {
    const { dialog } = renderDialog(fakeApi(), existingItem, {
      api: fakeLoyaltyApi(),
      canView: true,
      canConfigure: false,
    });

    const scope = () => within(dialog());
    expect(await scope().findByText('Mengikuti default')).toBeTruthy();
    expect(scope().getByText('1 poin / unit')).toBeTruthy();
    expect(scope().queryByLabelText('Poin per unit')).toBeNull();
  });

  it('creates an item without variants as the default sellable option', async () => {
    const api = fakeApi();
    const { dialog } = renderDialog(api, null);
    await type(within(dialog()).getByLabelText('Nama Item'), 'Teh');
    await type(within(dialog()).getByLabelText('Harga tanpa varian (IDR)'), '10000');
    await act(async () =>
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Simpan' })),
    );

    await waitFor(() => expect(api.createPrice).toHaveBeenCalledTimes(1));
    expect(api.createPrice).toHaveBeenCalledWith(
      expect.objectContaining({ catalogVariantId: null, amount: '10000' }),
    );
    expect(api.createVariant).not.toHaveBeenCalled();
    expect(api.changeVariantPrices).not.toHaveBeenCalled();
    expect(api.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ variantSelectionMode: 'OPTIONAL' }),
    );
  });

  it('applies one price to all new variants, keeps overrides, and persists explicit prices', async () => {
    const api = fakeApi();
    const { dialog } = renderDialog(api, null);
    const scope = () => within(dialog());
    await type(scope().getByLabelText('Nama Item'), 'Kopi');
    await act(async () => fireEvent.click(scope().getByLabelText(/Wajib pilih varian/)));

    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Tambah varian' })));
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Tambah varian' })));
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Tambah varian' })));
    await type(scope().getByLabelText('Nama varian 1'), 'Large / Iced');
    await type(scope().getByLabelText('Nama varian 2'), 'Small / Hot');
    await type(scope().getByLabelText('Nama varian 3'), 'Regular');

    await type(scope().getByLabelText('Harga untuk semua varian'), '28000');
    await act(async () =>
      fireEvent.click(scope().getByRole('button', { name: 'Terapkan ke 3 varian' })),
    );
    // Individual override after the bulk apply.
    await type(scope().getByLabelText('Harga Small / Hot'), '26000');
    // A variant added after the bulk apply needs its own price; removing it restores readiness.
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Tambah varian' })));
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Hapus varian 4' })));

    // Required mode: the default/item option is not offered as a sellable choice.
    expect(scope().queryByLabelText('Harga tanpa varian (IDR)')).toBeNull();
    expect(scope().queryByLabelText('Harga jual (IDR)')).toBeNull();
    const review = scope().getByRole('region', { name: 'Akan disimpan' });
    expect(review.textContent).not.toMatch(/Tanpa varian/);
    expect(review.textContent).toMatch(/Large \/ Iced\s*Rp\s?28\.000/);
    expect(review.textContent).toMatch(/Small \/ Hot\s*Rp\s?26\.000/);
    expect(review.textContent).toMatch(/Regular\s*Rp\s?28\.000/);

    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Simpan' })));

    await waitFor(() => expect(api.changeVariantPrices).toHaveBeenCalledTimes(2));
    expect(api.createVariant).toHaveBeenCalledTimes(3);
    // No fake "default" variant, and no item price sold alongside required variants.
    expect(api.createVariant.mock.calls.map(([, input]) => input.name)).toEqual([
      'Large / Iced',
      'Small / Hot',
      'Regular',
    ]);
    expect(api.createPrice).not.toHaveBeenCalled();
    expect(api.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ variantSelectionMode: 'REQUIRED' }),
    );
    expect(api.changeVariantPrices.mock.calls.map(([input]) => input)).toEqual([
      expect.objectContaining({ amount: '28000', catalogVariantIds: ['v-1', 'v-3'] }),
      expect.objectContaining({ amount: '26000', catalogVariantIds: ['v-2'] }),
    ]);
  });

  it('sells the item itself as a real option only when chosen, and requires its price', async () => {
    const api = fakeApi();
    const { dialog } = renderDialog(api, null);
    const scope = () => within(dialog());
    await type(scope().getByLabelText('Nama Item'), 'Es Teh');
    await act(async () => fireEvent.click(scope().getByLabelText(/Wajib pilih varian/)));
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Tambah varian' })));
    await type(scope().getByLabelText('Nama varian 1'), 'Large');
    await type(scope().getByLabelText('Harga Large'), '15000');
    await act(async () => fireEvent.click(scope().getByLabelText(/Bisa tanpa varian/)));

    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Simpan' })));
    expect(scope().getByText('Isi harga tanpa varian.')).toBeTruthy();
    expect(api.createItem).not.toHaveBeenCalled();

    await type(scope().getByLabelText('Harga tanpa varian (IDR)'), '10000');
    const review = scope().getByRole('region', { name: 'Akan disimpan' });
    expect(review.textContent).toMatch(/Tanpa varian\s*Rp\s?10\.000/);
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Simpan' })));

    await waitFor(() => expect(api.changeVariantPrices).toHaveBeenCalledTimes(1));
    expect(api.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ variantSelectionMode: 'OPTIONAL' }),
    );
    expect(api.createPrice).toHaveBeenCalledWith(
      expect.objectContaining({ catalogVariantId: null, amount: '10000' }),
    );
    expect(api.changeVariantPrices).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '15000', catalogVariantIds: ['v-1'] }),
    );
    expect(api.createVariant).toHaveBeenCalledTimes(1);
  });

  it('blocks required mode until at least one variant exists', async () => {
    const api = fakeApi();
    const { dialog } = renderDialog(api, null);
    const scope = () => within(dialog());

    await type(scope().getByLabelText('Nama Item'), 'Kopi');
    await act(async () => fireEvent.click(scope().getByLabelText(/Wajib pilih varian/)));
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Simpan' })));

    expect(scope().getByText('Varian wajib belum ditambahkan.')).toBeTruthy();
    expect(api.createItem).not.toHaveBeenCalled();
  });

  it('can add and price a new variant while editing an existing item', async () => {
    const api = fakeApi();
    const { dialog } = renderDialog(api, existingItem);
    const scope = () => within(dialog());

    expect(await scope().findByText('Varian wajib belum ditambahkan.')).toBeTruthy();
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Tambah varian' })));
    await type(scope().getByLabelText('Nama varian 1'), 'Large');
    await type(scope().getByLabelText('Harga Large'), '18000');
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Simpan' })));

    await waitFor(() => expect(api.createVariant).toHaveBeenCalledTimes(1));
    expect(api.updateItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ variantSelectionMode: 'REQUIRED' }),
    );
    expect(api.createVariant).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ name: 'Large', status: 'ACTIVE' }),
    );
    expect(api.changeVariantPrices).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '18000', catalogVariantIds: ['v-1'] }),
    );
  });

  it('changes the price without a variant and leaves every variant price untouched', async () => {
    const api = fakeApi({
      listDefaultPrices: vi.fn(async () => ({
        items: [
          { catalogItemId: 'item-1', catalogPriceId: 'p', currency: 'IDR', amount: '10000.0000' },
        ],
      })),
      listVariants: vi.fn(async () => ({
        items: [variant('v-a', 'Large')],
        limit: 50,
        offset: 0,
      })),
      resolvePrice: vi.fn(async () => ({
        catalogPriceId: 'p-v-a',
        catalogItemId: 'item-1',
        catalogVariantId: 'v-a',
        locationId: null,
        currency: 'IDR',
        amount: '15000.0000',
        effectiveAt: '2026-09-19T00:00:00.000Z',
        sourceScope: { catalogVariantId: 'v-a', locationId: null },
      })),
    });
    const { dialog } = renderDialog(api, { ...existingItem, variantSelectionMode: 'OPTIONAL' });
    const scope = () => within(dialog());
    await waitFor(() =>
      expect((scope().getByLabelText('Harga Large') as HTMLInputElement).value).not.toBe(''),
    );
    await type(scope().getByLabelText('Harga tanpa varian (IDR)'), '12000');
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Simpan' })));

    await waitFor(() => expect(api.changePrice).toHaveBeenCalledTimes(1));
    expect(api.changePrice).toHaveBeenCalledWith(
      expect.objectContaining({ catalogVariantId: null, amount: '12000' }),
    );
    expect(api.changeVariantPrices).not.toHaveBeenCalled();
    expect(api.updateItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ variantSelectionMode: 'OPTIONAL' }),
    );
  });

  it('blocks saving a new variant without an explicit price', async () => {
    const api = fakeApi();
    const { dialog } = renderDialog(api, null);
    const scope = () => within(dialog());
    await type(scope().getByLabelText('Nama Item'), 'Kopi');
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Tambah varian' })));
    await type(scope().getByLabelText('Nama varian 1'), 'Large');
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Simpan' })));

    expect(scope().getByText('Isi harga varian.')).toBeTruthy();
    expect(api.createItem).not.toHaveBeenCalled();
  });

  it('edits existing variant prices with bulk apply and sends only real changes', async () => {
    const resolved = (variantId: string, amount: string) => ({
      catalogPriceId: `p-${variantId}`,
      catalogItemId: 'item-1',
      catalogVariantId: variantId,
      locationId: null,
      currency: 'IDR',
      amount,
      effectiveAt: '2026-09-19T00:00:00.000Z',
      sourceScope: { catalogVariantId: variantId, locationId: null },
    });
    const api = fakeApi({
      listDefaultPrices: vi.fn(async () => ({
        items: [
          { catalogItemId: 'item-1', catalogPriceId: 'p', currency: 'IDR', amount: '25000.0000' },
        ],
      })),
      listVariants: vi.fn(async () => ({
        items: [variant('v-a', 'Large'), variant('v-b', 'Small')],
        limit: 50,
        offset: 0,
      })),
      resolvePrice: vi.fn(async ({ catalogVariantId }: { catalogVariantId: string }) =>
        resolved(catalogVariantId, catalogVariantId === 'v-a' ? '28000.0000' : '27000.0000'),
      ),
    });
    const { dialog } = renderDialog(api, existingItem);
    const scope = () => within(dialog());
    await waitFor(() =>
      expect((scope().getByLabelText('Harga Large') as HTMLInputElement).value).not.toBe(''),
    );

    await type(scope().getByLabelText('Harga untuk semua varian'), '28000');
    await act(async () =>
      fireEvent.click(scope().getByRole('button', { name: 'Terapkan ke 2 varian' })),
    );
    await act(async () => fireEvent.click(scope().getByRole('button', { name: 'Simpan' })));

    await waitFor(() => expect(api.changeVariantPrices).toHaveBeenCalledTimes(1));
    expect(api.changeVariantPrices).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '28000', catalogVariantIds: ['v-b'] }),
    );
    expect(api.changePrice).not.toHaveBeenCalled();
    expect(api.createVariant).not.toHaveBeenCalled();
  });
});
