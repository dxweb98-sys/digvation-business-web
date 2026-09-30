import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../../app/localization/backoffice-localization-base';
import type { LoyaltyApi } from '../../../../modules/loyalty/loyalty-api';
import type {
  CatalogApi,
  Item,
  ServiceComposition,
  ServiceCompositionComponent,
  Variant,
} from '../../api/catalog-api';
import { CatalogItemDialog } from './catalog-item-dialog';

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

const baseItem = {
  categoryId: null,
  description: null,
  lifecycle: 'ACTIVE',
  variantSelectionMode: 'REQUIRED',
  version: 2,
} as const;

const service: Item = {
  ...baseItem,
  id: 'svc',
  code: 'HAIR-COLOR',
  name: 'Hair Color',
  type: 'SERVICE',
  fulfillmentBehavior: 'TRACKED',
  productUsage: 'STANDALONE_AND_COMPONENT',
  serviceDefinition: { defaultDurationMinutes: null },
};

const product = (
  id: string,
  name: string,
  overrides: Partial<Item & { variantCount: number }> = {},
): Item & { variantCount: number } => ({
  ...baseItem,
  id,
  code: id.toUpperCase(),
  name,
  type: 'PRODUCT',
  fulfillmentBehavior: 'INSTANT',
  productUsage: 'STANDALONE_AND_COMPONENT',
  serviceDefinition: null,
  variantCount: 0,
  ...overrides,
});

const cap = product('cap', 'Disposable Cap', {
  productUsage: 'COMPONENT_ONLY',
  variantSelectionMode: 'OPTIONAL',
});
const medicine = product('med', 'Creambath Medicine', { variantSelectionMode: 'OPTIONAL' });
const dye = product('dye', 'Hair Dye', { variantSelectionMode: 'REQUIRED', variantCount: 2 });

const variant = (id: string, itemId: string, name: string): Variant => ({
  id,
  code: id.toUpperCase(),
  name,
  status: 'ACTIVE',
  version: 1,
  catalogItemId: itemId,
});

const component = (
  overrides: Partial<ServiceCompositionComponent> & { id: string },
): ServiceCompositionComponent => ({
  position: 0,
  componentItemId: 'cap',
  componentVariantId: null,
  quantity: '1.0000',
  pricingMode: 'INCLUDED_IN_SERVICE_PRICE',
  fixedUnitPrice: null,
  componentCode: 'CAP',
  componentName: 'Disposable Cap',
  componentUsage: 'COMPONENT_ONLY',
  componentVariantCode: null,
  componentVariantName: null,
  ...overrides,
});

function fakeApi(composition: ServiceComposition, overrides: Record<string, unknown> = {}) {
  const items: Record<string, Item> = { cap, med: medicine, dye, svc: service };
  return {
    getItem: vi.fn(async (id: string) => items[id]),
    updateItem: vi.fn(async (current: Item) => ({ ...current, version: current.version + 1 })),
    createItem: vi.fn(async () => ({ ...service, id: 'new-svc', version: 1 })),
    listItems: vi.fn(async () => ({ items: [cap, medicine, dye], limit: 20, offset: 0 })),
    listVariants: vi.fn(async (id: string) => ({
      items:
        id === 'svc'
          ? [variant('red', 'svc', 'Red'), variant('blue', 'svc', 'Blue')]
          : id === 'dye'
            ? [variant('dye-red', 'dye', 'Red'), variant('dye-blue', 'dye', 'Blue')]
            : [],
      limit: 50,
      offset: 0,
    })),
    listDefaultPrices: vi.fn(async () => ({ items: [] })),
    resolvePrice: vi.fn(
      async (input: { catalogItemId: string; catalogVariantId?: string | null }) => {
        if (input.catalogItemId === 'med')
          return {
            catalogPriceId: 'p-med',
            catalogItemId: 'med',
            catalogVariantId: null,
            locationId: null,
            currency: 'IDR',
            amount: '20000.0000',
            effectiveAt: '',
            sourceScope: { catalogVariantId: null, locationId: null },
          };
        return {
          catalogPriceId: 'p',
          catalogItemId: input.catalogItemId,
          catalogVariantId: input.catalogVariantId ?? null,
          locationId: null,
          currency: 'IDR',
          amount: '150000.0000',
          effectiveAt: '',
          sourceScope: { catalogVariantId: input.catalogVariantId ?? null, locationId: null },
        };
      },
    ),
    getItemImage: vi.fn(async () => null),
    getServiceComposition: vi.fn(async () => composition),
    replaceServiceComposition: vi.fn(async () => composition),
    createVariant: vi.fn(),
    changeVariantPrices: vi.fn(async () => ({ items: [] })),
    createPrice: vi.fn(async () => ({})),
    changePrice: vi.fn(async () => ({})),
    ...overrides,
  };
}

const empty: ServiceComposition = {
  catalogItemId: 'svc',
  version: 2,
  default: [],
  variantOverrides: [],
};

function renderDialog(mocks: ReturnType<typeof fakeApi>, item: Item | null) {
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <QueryClientProvider client={new QueryClient()}>
          <DToastProvider>
            <CatalogItemDialog
              item={item}
              categories={[]}
              currency="IDR"
              api={mocks as unknown as CatalogApi}
              loyaltyApi={{} as LoyaltyApi}
              canViewLoyalty={false}
              canConfigureLoyalty={false}
              canViewPricing
              canCreatePricing
              canCreateVariants
              canUpdateVariants
              canManageImage={false}
              canEditComposition
              onClose={vi.fn()}
              onSaved={vi.fn()}
            />
          </DToastProvider>
        </QueryClientProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
  return within(screen.getByRole('dialog'));
}

const click = (element: HTMLElement) =>
  act(() => {
    fireEvent.click(element);
  });

async function openComposition(scope: ReturnType<typeof within>) {
  await click(await scope.findByRole('tab', { name: /Komponen Jasa/ }));
  return scope.findByRole('tabpanel', { name: 'Komponen Jasa' });
}

afterEach(cleanup);

describe('Service additional-item requirement setting', () => {
  it('is shown for a Service, OFF by default, and saved when turned on', async () => {
    const api = fakeApi(empty);
    const scope = renderDialog(api, service);

    const toggle = (await scope.findByRole('checkbox', {
      name: /Wajib menggunakan item tambahan saat transaksi/,
    })) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(
      scope.getByText(
        /Operator harus memilih minimal satu item tambahan sebelum jasa dapat dimasukkan ke keranjang/,
      ),
    ).toBeTruthy();

    // Wait for the variants to hydrate so saving is not blocked by a partial editor.
    await scope.findByRole('tab', { name: /Harga & Varian.*2/ });
    await click(toggle);
    await click(scope.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(1));
    expect(api.updateItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        requireAdditionalItemAtSale: true,
      }),
    );
  });

  it('is checked when the saved Service already requires additional items', async () => {
    const saved: Item = {
      ...service,
      requireAdditionalItemAtSale: true,
    };
    const scope = renderDialog(fakeApi(empty), saved);
    const toggle = (await scope.findByRole('checkbox', {
      name: /Wajib menggunakan item tambahan saat transaksi/,
    })) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it('is shown for a Product too, because the requirement is item-level', async () => {
    const api = fakeApi(empty);
    const scope = renderDialog(api, product('p1', 'Kopi', { variantSelectionMode: 'OPTIONAL' }));
    const toggle = (await scope.findByRole('checkbox', {
      name: /Wajib menggunakan item tambahan saat transaksi/,
    })) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    await click(toggle);
    await click(scope.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(1));
    expect(api.updateItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ requireAdditionalItemAtSale: true }),
    );
  });
});

describe('Product usage control', () => {
  it('defaults an existing Product to directly sellable and saves component-only when unchecked', async () => {
    const api = fakeApi(empty);
    const scope = renderDialog(api, product('p1', 'Kopi', { variantSelectionMode: 'OPTIONAL' }));

    const checkbox = (await scope.findByRole('checkbox', {
      name: /Dapat dijual langsung/,
    })) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(scope.getByText(/Produk tersedia di kasir/)).toBeTruthy();

    await click(checkbox);
    expect(
      (scope.getByRole('checkbox', { name: /Dapat dijual langsung/ }) as HTMLInputElement).checked,
    ).toBe(false);
    expect(scope.getByText('Produk hanya digunakan sebagai komponen jasa.')).toBeTruthy();

    await click(scope.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(1));
    expect(api.updateItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ productUsage: 'COMPONENT_ONLY' }),
    );
  });

  it('shows the control only for Products', async () => {
    const scope = renderDialog(fakeApi(empty), service);
    await scope.findByRole('tab', { name: /Komponen Jasa/ });
    expect(scope.queryByRole('checkbox', { name: /Dapat dijual langsung/ })).toBeNull();
  });
});

describe('Service composition editor', () => {
  it('shows a Service default composition with included pricing and no price controls', async () => {
    const api = fakeApi({ ...empty, default: [component({ id: 'c1' })] });
    const scope = renderDialog(api, service);
    const panel = within(await openComposition(scope));

    expect(await panel.findByDisplayValue('Disposable Cap · Khusus Komponen')).toBeTruthy();
    const toggle = panel.getByRole('checkbox', {
      name: /Tambahkan harga komponen ke harga jasa/,
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(panel.getByText('Komponen sudah termasuk dalam harga jasa.')).toBeTruthy();
    expect(panel.queryByText('Sumber harga')).toBeNull();
  });

  it('reveals follow/fixed choices when the price toggle is on; follow is a read-only reference', async () => {
    const api = fakeApi({
      ...empty,
      default: [
        component({
          id: 'c1',
          componentItemId: 'med',
          componentName: 'Creambath Medicine',
          componentUsage: 'STANDALONE_AND_COMPONENT',
          quantity: '2.0000',
        }),
      ],
    });
    const scope = renderDialog(api, service);
    const panel = within(await openComposition(scope));

    await click(
      await panel.findByRole('checkbox', { name: /Tambahkan harga komponen ke harga jasa/ }),
    );
    expect(panel.getByText('Sumber harga')).toBeTruthy();
    expect(
      (panel.getByRole('radio', { name: 'Ikuti harga produk' }) as HTMLInputElement).checked,
    ).toBe(true);

    expect((await panel.findByTestId('component-reference-price')).textContent).toMatch(/20\.000/);
    expect((await panel.findByTestId('component-contribution')).textContent).toMatch(/40\.000/);
    // The reference is text, never an editable amount field.
    expect(panel.queryByLabelText('Harga khusus per unit')).toBeNull();

    await click(panel.getByRole('radio', { name: 'Harga khusus' }));
    const fixed = panel.getByLabelText('Harga khusus per unit') as HTMLInputElement;
    expect(fixed.disabled).toBe(false);
    await act(async () => {
      fireEvent.change(fixed, { target: { value: '18000' } });
    });
    await waitFor(() =>
      expect(panel.getByTestId('component-contribution').textContent).toMatch(/36\.000/),
    );
  });

  it('adds a component from Product search including component-only Products and saves explicit ids', async () => {
    const api = fakeApi(empty);
    const scope = renderDialog(api, service);
    const panel = within(await openComposition(scope));

    await click(await panel.findByRole('button', { name: 'Tambah komponen' }));
    const search = await panel.findByPlaceholderText('Cari produk');
    await act(async () => {
      fireEvent.focus(search);
      fireEvent.change(search, { target: { value: 'Cap' } });
    });
    await click(await screen.findByText('Disposable Cap · Khusus Komponen'));

    await click(scope.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(api.replaceServiceComposition).toHaveBeenCalledTimes(1));
    expect(api.replaceServiceComposition).toHaveBeenCalledWith('svc', {
      expectedVersion: 3,
      default: [
        {
          componentItemId: 'cap',
          componentVariantId: null,
          quantity: '1',
          pricingMode: 'INCLUDED_IN_SERVICE_PRICE',
          fixedUnitPrice: null,
        },
      ],
      variantOverrides: [
        { catalogVariantId: 'red', components: [] },
        { catalogVariantId: 'blue', components: [] },
      ],
    });
  });

  it('removes a component', async () => {
    const api = fakeApi({ ...empty, default: [component({ id: 'c1' })] });
    const scope = renderDialog(api, service);
    const panel = within(await openComposition(scope));

    await click(await panel.findByRole('button', { name: 'Hapus komponen' }));
    expect(panel.queryByDisplayValue('Disposable Cap · Khusus Komponen')).toBeNull();
    await click(scope.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(api.replaceServiceComposition).toHaveBeenCalled());
    expect(
      (
        api.replaceServiceComposition.mock.calls[0] as unknown as [string, { default: unknown[] }]
      )[1].default,
    ).toEqual([]);
  });

  it('requires a Product variant when Runtime requires one and blocks saving until chosen', async () => {
    const api = fakeApi({
      ...empty,
      default: [
        component({
          id: 'c1',
          componentItemId: 'dye',
          componentName: 'Hair Dye',
          componentUsage: 'STANDALONE_AND_COMPONENT',
        }),
      ],
    });
    const scope = renderDialog(api, service);
    const panel = within(await openComposition(scope));
    await panel.findByDisplayValue('Hair Dye');

    await click(scope.getByRole('button', { name: 'Simpan' }));
    expect(await panel.findByText('Pilih variant produk.')).toBeTruthy();
    expect(api.updateItem).not.toHaveBeenCalled();
    expect(api.replaceServiceComposition).not.toHaveBeenCalled();
  });

  it('rejects a non-positive quantity', async () => {
    const api = fakeApi({ ...empty, default: [component({ id: 'c1' })] });
    const scope = renderDialog(api, service);
    const panel = within(await openComposition(scope));
    const quantity = await panel.findByLabelText('Jumlah');
    await act(async () => {
      fireEvent.change(quantity, { target: { value: '0' } });
    });
    await click(scope.getByRole('button', { name: 'Simpan' }));
    expect(await panel.findByText(/Jumlah harus lebih dari nol/)).toBeTruthy();
    expect(api.replaceServiceComposition).not.toHaveBeenCalled();
  });

  it('prevents identical Product and Variant entries in one composition', async () => {
    const api = fakeApi({
      ...empty,
      default: [component({ id: 'c1' }), component({ id: 'c2', position: 1 })],
    });
    const scope = renderDialog(api, service);
    const panel = within(await openComposition(scope));
    expect(
      (await panel.findAllByText('Produk dan variant yang sama sudah ada di komponen ini.')).length,
    ).toBeGreaterThan(0);
    await click(scope.getByRole('button', { name: 'Simpan' }));
    expect(api.replaceServiceComposition).not.toHaveBeenCalled();
  });
});

describe('Service variant composition', () => {
  const withOverride: ServiceComposition = {
    ...empty,
    default: [component({ id: 'c1' })],
    variantOverrides: [
      {
        catalogVariantId: 'red',
        components: [
          component({
            id: 'o1',
            componentItemId: 'dye',
            componentName: 'Hair Dye',
            componentUsage: 'STANDALONE_AND_COMPONENT',
            componentVariantId: 'dye-red',
            componentVariantName: 'Red',
          }),
        ],
      },
    ],
  };

  it('distinguishes variants using the default from variants with their own composition', async () => {
    const scope = renderDialog(fakeApi(withOverride), service);
    const panel = within(await openComposition(scope));

    const red = within(await panel.findByRole('listitem', { name: 'Variant Red' }));
    const blue = within(panel.getByRole('listitem', { name: 'Variant Blue' }));
    expect(red.getByText('Komponen khusus')).toBeTruthy();
    expect(red.getByRole('button', { name: 'Gunakan komponen default' })).toBeTruthy();
    expect(blue.getByText('Komponen default')).toBeTruthy();
    expect(blue.getByRole('button', { name: 'Atur khusus untuk variant ini' })).toBeTruthy();
    expect(red.getByText(/menggantikan seluruh komponen default/)).toBeTruthy();
  });

  it('lets a variant define a full override starting from the default and reverts to default', async () => {
    const api = fakeApi({ ...empty, default: [component({ id: 'c1' })] });
    const scope = renderDialog(api, service);
    const panel = within(await openComposition(scope));

    const blue = () => within(panel.getByRole('listitem', { name: 'Variant Blue' }));
    await click(await blue().findByRole('button', { name: 'Atur khusus untuk variant ini' }));
    expect(blue().getByText('Komponen khusus')).toBeTruthy();

    await click(blue().getByRole('button', { name: 'Gunakan komponen default' }));
    expect(blue().getByText('Komponen default')).toBeTruthy();

    await click(scope.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(api.replaceServiceComposition).toHaveBeenCalled());
    const submitted = (
      api.replaceServiceComposition.mock.calls[0] as unknown as [
        string,
        { variantOverrides: Array<{ catalogVariantId: string; components: unknown[] }> },
      ]
    )[1];
    // Reverted variants are sent empty, which Runtime treats as "use the default".
    expect(submitted.variantOverrides).toEqual([
      { catalogVariantId: 'red', components: [] },
      { catalogVariantId: 'blue', components: [] },
    ]);
  });

  it('saves a custom variant composition with explicit Product variant ids', async () => {
    const api = fakeApi(withOverride);
    const scope = renderDialog(api, service);
    const panel = within(await openComposition(scope));
    await panel.findByRole('listitem', { name: 'Variant Red' });

    const quantity = panel.getAllByLabelText('Jumlah').at(-1) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(quantity, { target: { value: '2' } });
    });
    await click(scope.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(api.replaceServiceComposition).toHaveBeenCalled());
    const submitted = (
      api.replaceServiceComposition.mock.calls[0] as unknown as [
        string,
        {
          default: Array<{ componentItemId: string }>;
          variantOverrides: Array<{
            catalogVariantId: string;
            components: Array<{ componentVariantId: string | null; quantity: string }>;
          }>;
        },
      ]
    )[1];
    expect(submitted.default.map((c) => c.componentItemId)).toEqual(['cap']);
    expect(submitted.variantOverrides[0]).toEqual({
      catalogVariantId: 'red',
      components: [
        expect.objectContaining({
          componentItemId: 'dye',
          componentVariantId: 'dye-red',
          quantity: '2',
        }),
      ],
    });
  });
});
