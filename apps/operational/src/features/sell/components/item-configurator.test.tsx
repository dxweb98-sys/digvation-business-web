import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  CatalogItem,
  CatalogVariant,
  ComponentCandidate,
  FixedComponent,
} from '../cashier-transaction.types';
import { ItemConfigurator, type ItemConfiguratorState } from './item-configurator';

const price = (amount: string) => ({
  catalogPriceId: 'p',
  catalogItemId: 'x',
  catalogVariantId: null,
  locationId: null,
  currency: 'IDR',
  amount,
  effectiveAt: '',
  sourceScope: { catalogVariantId: null, locationId: null },
});

const baseItem = {
  categoryId: null,
  description: null,
  lifecycle: 'ACTIVE',
  version: 1,
  createdAt: '',
  updatedAt: '',
} as const;

const shampoo: CatalogItem = {
  ...baseItem,
  id: 'shampoo',
  code: 'SHAMPOO',
  name: 'Shampoo',
  type: 'PRODUCT',
  fulfillmentBehavior: 'INSTANT',
  serviceDefinition: null,
};
const service = (
  overrides: Partial<CatalogItem> = {},
  requireAdditionalItemAtSale = false,
): CatalogItem => ({
  ...baseItem,
  id: 'hair-color',
  code: 'HAIR-COLOR',
  name: 'Hair Color',
  type: 'SERVICE',
  fulfillmentBehavior: 'TRACKED',
  serviceDefinition: {
    defaultDurationMinutes: null,
    employeeAssignmentMode: 'REQUIRED',
    allowEmployeeContribution: true,
  },
  requireAdditionalItemAtSale,
  ...overrides,
});

const variant = (id: string, name: string, fixedComponents?: FixedComponent[]): CatalogVariant => ({
  id,
  code: id.toUpperCase(),
  name,
  status: 'ACTIVE',
  version: 1,
  createdAt: '',
  updatedAt: '',
  catalogItemId: 'hair-color',
  ...(fixedComponents ? { fixedComponents } : {}),
});

const fixedCap: FixedComponent = {
  componentItemId: 'cap',
  componentVariantId: null,
  itemName: 'Hair Cap',
  variantName: null,
  quantity: '1.0000',
};
const fixedDye: FixedComponent = {
  componentItemId: 'dye',
  componentVariantId: 'dye-red',
  itemName: 'Hair Dye',
  variantName: 'Red',
  quantity: '1.0000',
};

const candidate = (
  overrides: Partial<ComponentCandidate> & { id: string; name: string },
): ComponentCandidate => ({
  code: overrides.id.toUpperCase(),
  productUsage: 'STANDALONE_AND_COMPONENT',
  variantSelectionMode: 'OPTIONAL',
  resolvedPrice: price('10000.0000'),
  variants: [],
  ...overrides,
});
const candidates: ComponentCandidate[] = [
  candidate({ id: 'cap', name: 'Hair Cap', productUsage: 'COMPONENT_ONLY' }),
  candidate({ id: 'dye', name: 'Hair Dye' }),
  candidate({ id: 'ribbon', name: 'Satin Ribbon', productUsage: 'COMPONENT_ONLY' }),
  candidate({
    id: 'treatment',
    name: 'Hair Treatment',
    variantSelectionMode: 'REQUIRED',
    resolvedPrice: null,
    variants: [
      {
        id: 'premium',
        code: 'PREMIUM',
        name: 'Premium',
        status: 'ACTIVE',
        version: 1,
        createdAt: '',
        updatedAt: '',
        catalogItemId: 'treatment',
        resolvedPrice: price('20000.0000'),
      },
    ],
  }),
  candidate({ id: 'serum', name: 'Serum', resolvedPrice: price('5000.0000') }),
];

function renderConfigurator(
  state: Partial<ItemConfiguratorState> & { item: CatalogItem },
  options: { candidates?: ComponentCandidate[] } = {},
) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const loadCandidates = vi.fn(async () => ({ items: options.candidates ?? candidates }));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ItemConfigurator
        variants={[]}
        itemPrice="50000.0000"
        locale="id-ID"
        currency="IDR"
        {...state}
        loadCandidates={loadCandidates}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onConfirm, onClose, loadCandidates, dialog: () => within(screen.getByRole('dialog')) };
}

const click = (element: HTMLElement) =>
  act(() => {
    fireEvent.click(element);
  });
const addButton = () =>
  screen.getByRole('button', { name: /^Tambahkan ke keranjang/ }) as HTMLButtonElement;

/** Types into an additional-item search box; the combobox lists matching offered Products. */
async function search(index: number, text: string) {
  const inputs = await screen.findAllByRole('combobox', { name: 'Cari item tambahan' });
  const input = inputs[index]!;
  await act(async () => {
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: text } });
  });
}
async function chooseAdditional(index: number, name: string) {
  await search(index, name);
  await click(await screen.findByRole('option', { name }));
}
const offered = (name: string) => screen.queryByRole('option', { name }) !== null;

afterEach(cleanup);

describe('ItemConfigurator — simple item', () => {
  it('stays compact for a Product without variant, fixed components or additional items', async () => {
    const { onConfirm, dialog } = renderConfigurator({ item: shampoo });
    const scope = dialog();

    expect(scope.getByRole('heading', { name: 'Shampoo' })).toBeTruthy();
    expect(scope.getByText('Rp 50.000')).toBeTruthy();
    expect(scope.getByRole('group', { name: 'Jumlah' })).toBeTruthy();
    // Nothing else is rendered: no variant, fixed-component, additional or summary sections.
    expect(scope.queryByText('Pilih varian')).toBeNull();
    expect(scope.queryByText('Komponen termasuk')).toBeNull();
    expect(scope.queryByText('Item tambahan wajib')).toBeNull();
    expect(scope.queryByLabelText('Total item')).toBeNull();

    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith({
      catalogVariantId: null,
      quantity: '1',
      additionalComponents: [],
    });
  });

  it('lets the operator change the primary quantity before adding', async () => {
    const { onConfirm, dialog } = renderConfigurator({ item: shampoo });
    await click(dialog().getByRole('button', { name: 'Tambah jumlah' }));
    await click(dialog().getByRole('button', { name: 'Tambah jumlah' }));
    expect((dialog().getByRole('textbox', { name: 'Jumlah' }) as HTMLInputElement).value).toBe('3');
    // A quantity above one shows the item total.
    expect(dialog().getByTestId('configurator-total').textContent).toMatch(/150\.000/);

    await click(dialog().getByRole('button', { name: 'Kurangi jumlah' }));
    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ quantity: '2' }));
  });

  it('blocks a non-positive quantity', async () => {
    const { dialog } = renderConfigurator({ item: shampoo });
    await act(async () => {
      fireEvent.change(dialog().getByRole('textbox', { name: 'Jumlah' }), {
        target: { value: '0' },
      });
    });
    expect(addButton().disabled).toBe(true);
  });

  it('opens for a Service without variant as well', async () => {
    const { onConfirm, dialog } = renderConfigurator({ item: service(), itemPrice: '75000.0000' });
    expect(dialog().getByRole('heading', { name: 'Hair Color' })).toBeTruthy();
    expect(dialog().queryByText('Pilih varian')).toBeNull();
    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ catalogVariantId: null }));
  });

  it('is unavailable when no price is available', () => {
    renderConfigurator({ item: shampoo, itemPrice: null });
    expect(addButton().disabled).toBe(true);
    expect(screen.getByText('Harga pilihan ini belum tersedia.')).toBeTruthy();
  });
});

describe('ItemConfigurator — variants and fixed components', () => {
  const variants = [variant('red', 'Red', [fixedCap, fixedDye]), variant('blue', 'Blue', [])];
  const prices = { red: '150000.0000', blue: '140000.0000' };

  it('shows a variant section only when the item has variants and requires a choice', async () => {
    const { onConfirm, dialog } = renderConfigurator({
      item: service(),
      variants,
      itemPrice: null,
      pricesByVariantId: prices,
    });
    expect(dialog().getByRole('region', { name: 'Pilih varian' })).toBeTruthy();
    expect(addButton().disabled).toBe(true);

    await click(dialog().getByText('Blue'));
    expect(addButton().disabled).toBe(false);
    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ catalogVariantId: 'blue' }));
  });

  it('shows read-only fixed components only for a selection that has them', async () => {
    const { dialog } = renderConfigurator({
      item: service(),
      variants,
      itemPrice: null,
      pricesByVariantId: prices,
    });
    expect(dialog().queryByText('Komponen termasuk')).toBeNull();

    await click(dialog().getByText('Red'));
    const list = within(dialog().getByRole('region', { name: 'Komponen termasuk' }));
    expect(list.getByText(/Hair Cap × 1/)).toBeTruthy();
    expect(list.getByText(/Hair Dye \/ Red × 1/)).toBeTruthy();
    // Read-only context: nothing to click or edit.
    expect(list.queryAllByRole('button')).toHaveLength(0);
    expect(list.queryAllByRole('textbox')).toHaveLength(0);

    await click(dialog().getByText('Blue'));
    expect(dialog().queryByText('Komponen termasuk')).toBeNull();
  });

  it('offers the item itself as a separate option when Catalog sells it without a variant', async () => {
    const { onConfirm, dialog } = renderConfigurator({
      item: service(),
      variants,
      itemOption: { price: '120000.0000' },
      itemPrice: null,
      pricesByVariantId: prices,
    });
    expect(dialog().getByRole('region', { name: 'Pilih opsi' })).toBeTruthy();
    await click(dialog().getByText('Tanpa varian'));
    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ catalogVariantId: null }));
  });
});

describe('ItemConfigurator — additional items', () => {
  const variants = [variant('red', 'Red', [fixedCap, fixedDye])];
  const required = () =>
    renderConfigurator({
      item: service({}, true),
      variants,
      itemPrice: null,
      pricesByVariantId: { red: '150000.0000' },
    });

  const toggle = () => screen.getByRole('switch', { name: 'Gunakan item tambahan' }) as HTMLElement;

  it('offers an optional item the toggle: off by default, enabled, and Add works without additions', async () => {
    const { onConfirm, dialog } = renderConfigurator({
      item: service({}, false),
      variants,
      itemPrice: null,
      pricesByVariantId: { red: '150000.0000' },
    });
    await click(dialog().getByText('Red'));
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    expect((toggle() as HTMLButtonElement).disabled).toBe(false);
    expect(dialog().queryByRole('combobox', { name: 'Cari item tambahan' })).toBeNull();
    expect(addButton().disabled).toBe(false);
    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith({
      catalogVariantId: 'red',
      quantity: '1',
      additionalComponents: [],
    });
  });

  it('does not create a snapshot when the toggle is on but nothing is chosen', async () => {
    const { onConfirm, dialog } = renderConfigurator({
      item: shampoo,
      itemPrice: '200000.0000',
    });
    await click(toggle());
    expect(await screen.findAllByRole('combobox', { name: 'Cari item tambahan' })).toHaveLength(1);
    expect(addButton().disabled).toBe(false);
    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith({
      catalogVariantId: null,
      quantity: '1',
      additionalComponents: [],
    });
    void dialog;
  });

  it('clears the addition draft when the toggle is turned off', async () => {
    const { onConfirm } = renderConfigurator({ item: shampoo, itemPrice: '200000.0000' });
    await click(toggle());
    await chooseAdditional(0, 'Serum');
    expect(screen.getByTestId('configurator-total').textContent).toContain('205.000');
    await click(toggle());
    expect(screen.queryByRole('combobox', { name: 'Cari item tambahan' })).toBeNull();
    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ additionalComponents: [] }));
  });

  it('sells a Product with an addition: 200.000 + 10.000 = 210.000', async () => {
    const { onConfirm } = renderConfigurator({ item: shampoo, itemPrice: '200000.0000' });
    await click(toggle());
    await chooseAdditional(0, 'Hair Dye');
    expect(screen.getByTestId('configurator-total').textContent).toContain('210.000');
    await click(addButton());
    expect(onConfirm.mock.calls[0]![0].additionalComponents).toHaveLength(1);
  });

  it('never offers the item being sold as its own addition', async () => {
    renderConfigurator(
      { item: { ...shampoo, requireAdditionalItemAtSale: true }, itemPrice: '200000.0000' },
      { candidates: [candidate({ id: 'shampoo', name: 'Shampoo' }), ...candidates] },
    );
    await search(0, 'Shampoo');
    expect(offered('Shampoo')).toBe(false);
  });

  it('shows a required item with the toggle on and disabled, and an actionable blocker when nothing is eligible', async () => {
    const { dialog } = renderConfigurator(
      { item: { ...shampoo, requireAdditionalItemAtSale: true }, itemPrice: '200000.0000' },
      { candidates: [] },
    );
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    expect((toggle() as HTMLButtonElement).disabled).toBe(true);
    expect(await dialog().findByRole('alert')).toBeTruthy();
    expect(dialog().getByRole('alert').textContent).toContain('Backoffice');
    expect(addButton().disabled).toBe(true);
  });

  it('reopens a cart line prefilled: variant, quantity, additions', async () => {
    const { onConfirm } = renderConfigurator({
      item: service({}, false),
      variants,
      itemPrice: null,
      pricesByVariantId: { red: '150000.0000' },
      initial: {
        catalogVariantId: 'red',
        quantity: '2.0000',
        additionalComponents: [
          { componentItemId: 'serum', quantity: '3.0000', label: 'Serum', unitPrice: '5000.0000' },
        ],
      },
      confirmLabel: 'Simpan perubahan',
    } as never);
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    expect((screen.getByRole('textbox', { name: 'Jumlah' }) as HTMLInputElement).value).toBe('2');
    expect(screen.getByTestId('configurator-total').textContent).toContain('330.000');
    await click(screen.getByRole('button', { name: /^Simpan perubahan/ }));
    expect(onConfirm).toHaveBeenCalledWith({
      catalogVariantId: 'red',
      quantity: '2',
      additionalComponents: [
        { componentItemId: 'serum', quantity: '3.0000', label: 'Serum', unitPrice: '5000.0000' },
      ],
    });
  });

  it('shows a required additional-item section and keeps Add disabled until one is chosen', async () => {
    const { onConfirm, dialog } = required();
    await click(dialog().getByText('Red'));

    expect(toggle().getAttribute('aria-checked')).toBe('true');
    expect((toggle() as HTMLButtonElement).disabled).toBe(true);
    expect(dialog().getAllByText('Pilih minimal satu item tambahan.').length).toBeGreaterThan(0);
    expect(addButton().disabled).toBe(true);

    await chooseAdditional(0, 'Serum');
    expect(addButton().disabled).toBe(false);

    await click(addButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      catalogVariantId: 'red',
      quantity: '1',
      additionalComponents: [
        {
          componentItemId: 'serum',
          quantity: '1.0000',
          label: 'Serum',
          unitPrice: '5000.0000',
        },
      ],
    });
  });

  it('does not offer fixed BOM Products but does offer component-only Products', async () => {
    const { dialog } = required();
    await click(dialog().getByText('Red'));
    await search(0, 'Hair');
    await screen.findByRole('option', { name: 'Hair Treatment' });
    expect(offered('Hair Cap')).toBe(false);
    expect(offered('Hair Dye')).toBe(false);

    // A component-only Product outside the fixed BOM is a valid additional item.
    await search(0, 'Ribbon');
    expect(await screen.findByRole('option', { name: 'Satin Ribbon' })).toBeTruthy();
    await search(0, 'Serum');
    expect(await screen.findByRole('option', { name: 'Serum' })).toBeTruthy();
  });

  it('requires an explicit variant for a Product that needs one, then accepts it', async () => {
    const { onConfirm, dialog } = required();
    await click(dialog().getByText('Red'));
    await chooseAdditional(0, 'Hair Treatment');

    expect(await dialog().findByLabelText('Varian')).toBeTruthy();
    expect(addButton().disabled).toBe(true);

    await click(dialog().getByLabelText('Varian'));
    await click(await screen.findByRole('option', { name: /Premium/ }));
    expect(addButton().disabled).toBe(false);

    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalComponents: [
          expect.objectContaining({
            componentItemId: 'treatment',
            componentVariantId: 'premium',
            label: 'Hair Treatment / Premium',
          }),
        ],
      }),
    );
  });

  it('gives every additional item its own quantity and updates the total', async () => {
    const { onConfirm, dialog } = required();
    await click(dialog().getByText('Red'));
    await chooseAdditional(0, 'Serum');

    const quantity = dialog().getByRole('group', { name: 'Item tambahan' });
    await click(within(quantity).getByRole('button', { name: 'Tambah jumlah' }));
    expect((within(quantity).getByRole('textbox') as HTMLInputElement).value).toBe('2');
    // 150.000 + 2 x 5.000
    expect(dialog().getByTestId('configurator-total').textContent).toMatch(/160\.000/);

    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalComponents: [
          expect.objectContaining({ componentItemId: 'serum', quantity: '2.0000' }),
        ],
      }),
    );
  });

  it('allows several additional items, never the same Product twice, and restores a removed one', async () => {
    const { onConfirm, dialog } = required();
    await click(dialog().getByText('Red'));
    await chooseAdditional(0, 'Serum');

    await click(dialog().getByRole('button', { name: 'Tambah item lain' }));
    await search(1, 'S');
    await screen.findByRole('option', { name: 'Satin Ribbon' });
    // Already chosen in the first row, so it is not offered again.
    expect(offered('Serum')).toBe(false);
    await click(screen.getByRole('option', { name: 'Satin Ribbon' }));

    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalComponents: [
          expect.objectContaining({ componentItemId: 'serum' }),
          expect.objectContaining({ componentItemId: 'ribbon' }),
        ],
      }),
    );
  });

  it('restores a removed additional item as a candidate', async () => {
    const { dialog } = required();
    await click(dialog().getByText('Red'));
    await chooseAdditional(0, 'Serum');
    await click(dialog().getByRole('button', { name: 'Tambah item lain' }));

    await click(dialog().getAllByRole('button', { name: 'Hapus item tambahan' })[0]!);
    await search(0, 'Serum');
    expect(await screen.findByRole('option', { name: 'Serum' })).toBeTruthy();
  });

  it('shows one summary with the Service price, additional items and total', async () => {
    const { dialog } = required();
    await click(dialog().getByText('Red'));
    await chooseAdditional(0, 'Serum');
    const summary = within(dialog().getByLabelText('Total item'));
    expect(summary.getByText('Harga item')).toBeTruthy();
    expect(summary.getByText(/\+ Rp 5\.000/)).toBeTruthy();
    expect(dialog().getByTestId('configurator-total').textContent).toMatch(/155\.000/);
  });
});

describe('ItemConfigurator — per-unit additions', () => {
  const toggle = () => screen.getByRole('switch', { name: /Gunakan item tambahan/ }) as HTMLElement;
  const unitButton = (index: number) =>
    screen.getByRole('button', { name: new RegExp(`^Unit ${index}(?![0-9])`) });
  const setQuantity = (value: string) =>
    act(() => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Jumlah' }), { target: { value } });
    });
  const product = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
    ...shampoo,
    ...overrides,
  });

  it('shows no unit selector for quantity 1 and one per unit from quantity 2', async () => {
    renderConfigurator({ item: product(), itemPrice: '200000.0000' });
    expect(screen.queryByRole('group', { name: 'Unit' })).toBeNull();
    setQuantity('2');
    expect(unitButton(1)).toBeTruthy();
    expect(unitButton(2)).toBeTruthy();
  });

  it('configures each unit independently: unit 1 addition A, unit 2 addition B, exact total, no average', async () => {
    const { onConfirm } = renderConfigurator({ item: product(), itemPrice: '200000.0000' });
    setQuantity('2');
    await click(toggle());
    await chooseAdditional(0, 'Hair Dye'); // 10.000
    await click(unitButton(2));
    await click(toggle());
    await chooseAdditional(0, 'Serum'); // 5.000
    // 200.000 + 10.000 and 200.000 + 5.000 = 415.000; two units of one shared price would differ.
    expect(screen.getByTestId('configurator-total').textContent).toContain('415.000');
    expect(screen.getByLabelText('Total item').textContent).toMatch(
      /Unit 1.*210\.000.*Unit 2.*205\.000/,
    );
    await click(addButton());
    const configuration = onConfirm.mock.calls[0]![0];
    expect(configuration.additionalComponents).toEqual([]);
    expect(configuration.unitAdditions).toHaveLength(2);
    expect(configuration.unitAdditions[0][0]).toMatchObject({ componentItemId: 'dye' });
    expect(configuration.unitAdditions[1][0]).toMatchObject({ componentItemId: 'serum' });
    expect(document.body.textContent).not.toContain('207.500');
  });

  it('turning additions off on one unit does not touch the other', async () => {
    const { onConfirm } = renderConfigurator({ item: product(), itemPrice: '200000.0000' });
    setQuantity('2');
    await click(toggle());
    await chooseAdditional(0, 'Hair Dye');
    await click(unitButton(2));
    await click(toggle());
    await click(toggle()); // on then off again: this unit stays empty
    await click(unitButton(1));
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    await click(addButton());
    const configuration = onConfirm.mock.calls[0]![0];
    expect(configuration.unitAdditions[0]).toHaveLength(1);
    expect(configuration.unitAdditions[1]).toEqual([]);
  });

  it('keeps identical units as one configuration so they can group', async () => {
    const { onConfirm } = renderConfigurator({ item: product(), itemPrice: '200000.0000' });
    setQuantity('2');
    await click(toggle());
    await chooseAdditional(0, 'Hair Dye');
    await click(screen.getByRole('button', { name: 'Terapkan ke semua unit' }));
    await click(addButton());
    const configuration = onConfirm.mock.calls[0]![0];
    expect(configuration.unitAdditions).toBeUndefined();
    expect(configuration.additionalComponents).toHaveLength(1);
    expect(configuration.quantity).toBe('2');
  });

  it('requires every unit to satisfy a required item, and never copies an addition into a new unit', async () => {
    const { onConfirm } = renderConfigurator({
      item: product({ requireAdditionalItemAtSale: true }),
      itemPrice: '200000.0000',
    });
    await chooseAdditional(0, 'Hair Dye');
    expect(addButton().disabled).toBe(false);
    setQuantity('2');
    // The new unit starts empty and required, so the item is blocked again until it is satisfied.
    expect(addButton().disabled).toBe(true);
    await click(unitButton(2));
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    expect(
      toggle().hasAttribute('disabled') || toggle().getAttribute('aria-disabled') === 'true',
    ).toBe(true);
    await chooseAdditional(0, 'Serum');
    expect(addButton().disabled).toBe(false);
    await click(addButton());
    expect(onConfirm.mock.calls[0]![0].unitAdditions).toHaveLength(2);
  });

  it('shrinking the quantity keeps the leading units and drops the rest', async () => {
    const { onConfirm } = renderConfigurator({ item: product(), itemPrice: '200000.0000' });
    setQuantity('3');
    await click(toggle());
    await chooseAdditional(0, 'Hair Dye');
    setQuantity('2');
    expect(screen.queryByRole('button', { name: /^Unit 3/ })).toBeNull();
    await click(addButton());
    const configuration = onConfirm.mock.calls[0]![0];
    expect(configuration.unitAdditions).toHaveLength(2);
    expect(configuration.unitAdditions[0]).toHaveLength(1);
    expect(configuration.unitAdditions[1]).toEqual([]);
  });

  it('reopens a heterogeneous group with every unit restored, then edits only unit 2', async () => {
    const dye = {
      componentItemId: 'dye',
      quantity: '1.0000',
      label: 'Hair Dye',
      unitPrice: '10000.0000',
    };
    const serum = {
      componentItemId: 'serum',
      quantity: '1.0000',
      label: 'Serum',
      unitPrice: '5000.0000',
    };
    const { onConfirm } = renderConfigurator({
      item: product(),
      itemPrice: '200000.0000',
      initial: {
        catalogVariantId: null,
        quantity: '2.0000',
        additionalComponents: [],
        unitAdditions: [[dye], [serum]],
      },
    } as never);
    expect(screen.getByTestId('configurator-total').textContent).toContain('415.000');
    await click(unitButton(2));
    await click(screen.getAllByRole('button', { name: 'Tambah jumlah' })[1]!);
    await click(screen.getByRole('button', { name: /^Simpan perubahan|^Tambahkan ke keranjang/ }));
    const configuration = onConfirm.mock.calls[0]![0];
    expect(configuration.unitAdditions[0]).toEqual([dye]);
    expect(configuration.unitAdditions[1]).toHaveLength(1);
  });

  it('scales to a larger quantity: one compact scrolling list, the current unit marked, prev/next navigation', async () => {
    renderConfigurator({ item: product(), itemPrice: '200000.0000' });
    setQuantity('12');
    const list = screen.getByRole('list', { name: 'Unit' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(12);
    // Its own scroll box: no wrapping row of controls, no horizontal growth with the quantity.
    expect(list.className).toContain('overflow-y-auto');
    expect(list.className).toContain('max-h-');
    expect(unitButton(1).getAttribute('aria-current')).toBe('true');
    await click(screen.getByRole('button', { name: 'Unit berikutnya' }));
    expect(unitButton(2).getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('Unit 2 dari 12')).toBeTruthy();
    await click(unitButton(9));
    expect(screen.getByText('Unit 9 dari 12')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Unit sebelumnya' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('shows which required units are incomplete and which are done, for quantity 6', async () => {
    renderConfigurator({
      item: product({ requireAdditionalItemAtSale: true }),
      itemPrice: '200000.0000',
    });
    setQuantity('6');
    expect(screen.getByText('0 dari 6 unit lengkap')).toBeTruthy();
    for (let unit = 1; unit <= 6; unit += 1)
      expect(unitButton(unit).textContent).toContain('Belum lengkap');
    await chooseAdditional(0, 'Hair Dye');
    expect(screen.getByText('1 dari 6 unit lengkap')).toBeTruthy();
    expect(unitButton(1).textContent).toContain('Hair Dye');
    expect(unitButton(2).textContent).toContain('Belum lengkap');
    expect(addButton().disabled).toBe(true);
  });

  it('shows optional units without additions as such, never as a problem', async () => {
    renderConfigurator({ item: product(), itemPrice: '200000.0000' });
    setQuantity('3');
    expect(screen.getByText('3 dari 3 unit lengkap')).toBeTruthy();
    expect(unitButton(2).textContent).toContain('Tanpa item tambahan');
    expect(addButton().disabled).toBe(false);
  });
});

describe('ItemConfigurator — Product salesperson', () => {
  const salespeople = [
    { id: 'emp-andi', name: 'Andi' },
    { id: 'emp-budi', name: 'Budi' },
  ];
  const field = () => screen.queryByLabelText('Dijual oleh', { selector: 'button' });
  const chooseSalesperson = async (name: string) => {
    await click(field()!);
    await click(await screen.findByRole('option', { name }));
  };

  it('shows the optional "Dijual oleh" field for a Product and lists only the offered candidates', async () => {
    renderConfigurator({ item: shampoo, salespeople });
    expect(field()).not.toBeNull();
    await click(field()!);
    expect(offered('Andi')).toBe(true);
    expect(offered('Budi')).toBe(true);
    expect(offered('Citra')).toBe(false);
  });

  it('does not show the field for a Service', () => {
    renderConfigurator({ item: service(), salespeople, variants: [], itemPrice: '75000.0000' });
    expect(field()).toBeNull();
  });

  it('does not show the field when Runtime offered no salesperson list at all', () => {
    renderConfigurator({ item: shampoo });
    expect(field()).toBeNull();
  });

  it('allows adding without a salesperson and sends no salesperson', async () => {
    const { onConfirm } = renderConfigurator({ item: shampoo, salespeople });
    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith({
      catalogVariantId: null,
      quantity: '1',
      additionalComponents: [],
    });
  });

  it('sends the chosen salesperson and keeps it through a quantity change', async () => {
    const { onConfirm, dialog } = renderConfigurator({ item: shampoo, salespeople });
    await chooseSalesperson('Andi');
    await click(dialog().getByRole('button', { name: 'Tambah jumlah' }));
    await click(dialog().getByRole('button', { name: 'Tambah jumlah' }));
    await click(addButton());
    expect(onConfirm).toHaveBeenCalledWith({
      catalogVariantId: null,
      quantity: '3',
      additionalComponents: [],
      soldBy: { employeeId: 'emp-andi', name: 'Andi' },
    });
  });

  it('reopens a line with its previous salesperson and lets it change', async () => {
    const onConfirm = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ItemConfigurator
          item={shampoo}
          variants={[]}
          itemPrice="50000.0000"
          salespeople={salespeople}
          initial={{
            catalogVariantId: null,
            quantity: '2',
            additionalComponents: [],
            soldBy: { employeeId: 'emp-andi', name: 'Andi' },
          }}
          onConfirm={onConfirm}
        />
      </QueryClientProvider>,
    );
    expect(field()!.textContent).toMatch(/Andi/);
    await chooseSalesperson('Budi');
    await click(screen.getByRole('button', { name: /^Simpan perubahan/ }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ soldBy: { employeeId: 'emp-budi', name: 'Budi' } }),
    );
  });

  it('keeps a reopened salesperson visible even when they are no longer a candidate', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ItemConfigurator
          item={shampoo}
          variants={[]}
          itemPrice="50000.0000"
          salespeople={[{ id: 'emp-budi', name: 'Budi' }]}
          initial={{
            catalogVariantId: null,
            quantity: '1',
            additionalComponents: [],
            soldBy: { employeeId: 'emp-andi', name: 'Andi' },
          }}
        />
      </QueryClientProvider>,
    );
    expect(field()!.textContent).toMatch(/Andi/);
  });
});

describe('ItemConfigurator — who performs a Service addition ("Dikerjakan oleh")', () => {
  const performers = [
    { id: 'emp-andini', name: 'Andini' },
    { id: 'emp-heru', name: 'Pak Heru' },
    { id: 'emp-rindu', name: 'Rindu' },
  ];
  const variants = [variant('red', 'Red', [fixedCap])];
  const hairColor = (state: Partial<ItemConfiguratorState> = {}) =>
    renderConfigurator({
      item: service({}, true),
      variants,
      itemPrice: null,
      pricesByVariantId: { red: '200000.0000' },
      componentPerformers: performers,
      salespeople: performers,
      ...state,
    });
  const groups = () => screen.queryAllByRole('group', { name: 'Dikerjakan oleh' });
  async function addPerformer(groupIndex: number, name: string) {
    const group = within(groups()[groupIndex]!);
    await click(group.getByRole('button', { name: /Tambah yang mengerjakan/ }));
    await click(await screen.findByRole('option', { name }));
  }

  it('shows "Dikerjakan oleh" on a chosen addition, never "Dijual oleh" for the Service', async () => {
    const { dialog } = hairColor();
    await click(dialog().getByText('Red'));
    expect(groups()).toHaveLength(0);
    await chooseAdditional(0, 'Serum');
    expect(groups()).toHaveLength(1);
    expect(screen.queryByLabelText('Dijual oleh', { selector: 'button' })).toBeNull();
  });

  it('sends one or several performers with the addition, as Service work', async () => {
    const { onConfirm, dialog } = hairColor();
    await click(dialog().getByText('Red'));
    await chooseAdditional(0, 'Serum');
    await addPerformer(0, 'Pak Heru');
    await addPerformer(0, 'Rindu');
    await click(addButton());
    expect(onConfirm.mock.calls[0]![0].additionalComponents).toEqual([
      expect.objectContaining({
        componentItemId: 'serum',
        performers: [
          { employeeId: 'emp-heru', name: 'Pak Heru' },
          { employeeId: 'emp-rindu', name: 'Rindu' },
        ],
      }),
    ]);
    expect(onConfirm.mock.calls[0]![0].soldBy).toBeUndefined();
  });

  it('keeps each addition independent: different employees, or the same one when chosen', async () => {
    const { onConfirm, dialog } = hairColor();
    await click(dialog().getByText('Red'));
    await chooseAdditional(0, 'Serum');
    await click(dialog().getByRole('button', { name: 'Tambah item lain' }));
    await chooseAdditional(1, 'Satin Ribbon');
    await addPerformer(0, 'Pak Heru');
    await addPerformer(1, 'Rindu');
    // Andini (who may also perform the base Service) can be chosen explicitly too.
    await addPerformer(1, 'Andini');
    await click(addButton());
    const [serum, ribbon] = onConfirm.mock.calls[0]![0].additionalComponents;
    expect(serum.performers).toEqual([{ employeeId: 'emp-heru', name: 'Pak Heru' }]);
    expect(ribbon.performers).toEqual([
      { employeeId: 'emp-rindu', name: 'Rindu' },
      { employeeId: 'emp-andini', name: 'Andini' },
    ]);
  });

  it('removes a performer, and an employee is never listed twice for one addition', async () => {
    const { onConfirm, dialog } = hairColor();
    await click(dialog().getByText('Red'));
    await chooseAdditional(0, 'Serum');
    await addPerformer(0, 'Pak Heru');
    await click(within(groups()[0]!).getByRole('button', { name: /Tambah yang mengerjakan/ }));
    expect(offered('Pak Heru')).toBe(false);
    await click(screen.getByRole('option', { name: 'Rindu' }));
    await click(
      within(groups()[0]!).getByRole('button', { name: 'Hapus yang mengerjakan Pak Heru' }),
    );
    await click(addButton());
    expect(onConfirm.mock.calls[0]![0].additionalComponents[0].performers).toEqual([
      { employeeId: 'emp-rindu', name: 'Rindu' },
    ]);
  });

  it('reopens a line with its additions’ performers, resolving names from the eligible list', async () => {
    const { onConfirm } = hairColor({
      initial: {
        catalogVariantId: 'red',
        quantity: '1',
        additionalComponents: [
          {
            componentItemId: 'serum',
            quantity: '1.0000',
            label: 'Serum',
            unitPrice: '5000.0000',
            performers: [{ employeeId: 'emp-heru', name: '' }],
          },
        ],
      },
      confirmLabel: 'Simpan perubahan',
    } as never);
    expect(within(groups()[0]!).getByText('Pak Heru')).toBeTruthy();
    await click(screen.getByRole('button', { name: /^Simpan perubahan/ }));
    expect(onConfirm.mock.calls[0]![0].additionalComponents[0].performers).toEqual([
      { employeeId: 'emp-heru', name: '' },
    ]);
  });

  it('clears the performers when a different Product is chosen for the addition', async () => {
    const { onConfirm, dialog } = hairColor();
    await click(dialog().getByText('Red'));
    await chooseAdditional(0, 'Serum');
    await addPerformer(0, 'Pak Heru');
    await chooseAdditional(0, 'Hair Dye');
    await click(addButton());
    const [addition] = onConfirm.mock.calls[0]![0].additionalComponents;
    expect(addition.componentItemId).toBe('dye');
    expect(addition.performers).toBeUndefined();
  });

  it('offers no performer picker for a Product item', async () => {
    renderConfigurator({ item: shampoo, componentPerformers: performers });
    expect(groups()).toHaveLength(0);
  });
});
