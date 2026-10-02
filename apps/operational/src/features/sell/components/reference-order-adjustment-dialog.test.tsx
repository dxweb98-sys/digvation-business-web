import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation-labs/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReplaceLinePreview } from '../cashier-transaction.adapter';
import type { CatalogItem, ComponentCandidate, Sale, SaleLine } from '../cashier-transaction.types';
import { ReferenceOrderAdjustmentDialog } from './replatformed-pos-workspace';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const catalogItem = (
  id: string,
  code: string,
  name: string,
  type: 'PRODUCT' | 'SERVICE',
  extra: object = {},
) =>
  ({
    id,
    code,
    name,
    type,
    lifecycle: 'ACTIVE',
    variantSelectionMode: 'NONE',
    variants: [],
    ...extra,
  }) as unknown as CatalogItem;

/** Every active item, as the workspace passes it: Products and Services, never page-filtered. */
const items = [
  catalogItem('source-item', 'SRC', 'Smoothing Curly', 'SERVICE'),
  catalogItem('replacement-item', 'RPL', 'Hair Color', 'SERVICE'),
  catalogItem('shampoo', 'SHP', 'Shampoo Premium', 'PRODUCT', {
    variants: [{ id: 'v-500', code: 'SHP-500', name: 'Botol 500ml', status: 'ACTIVE' }],
  }),
  catalogItem('resin', 'CMP', 'Resin Komponen', 'PRODUCT', { productUsage: 'COMPONENT_ONLY' }),
  catalogItem('single', 'QA1', 'QA Item Tunggal', 'PRODUCT'),
  catalogItem('color', 'CLR', 'Color Treatment', 'SERVICE', {
    variantSelectionMode: 'REQUIRED',
    variants: [
      { id: 'red', code: 'CLR-RED', name: 'Red', status: 'ACTIVE' },
      { id: 'blue', code: 'CLR-BLUE', name: 'Blue', status: 'ACTIVE' },
    ],
  }),
];

type WorkState = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';

function sale(
  status: 'OPEN' | 'FINALIZED' = 'OPEN',
  fulfillmentStatus: WorkState = 'IN_PROGRESS',
  method: 'CASH' | 'BANK_TRANSFER' = 'CASH',
  operationalState: 'QUEUED' | 'IN_PROGRESS' = 'IN_PROGRESS',
) {
  return {
    id: 'sale-1',
    saleNumber: 'TRX-1',
    currency: 'IDR',
    status,
    operationalState,
    version: 3,
    totalAmount: '100000.0000',
    payments: [
      {
        id: 'payment-1',
        status: 'SUCCEEDED',
        method,
        appliedAmount: '100000.0000',
        tenderedAmount: null,
        changeAmount: null,
      },
    ],
    lines: [
      {
        id: 'source-line',
        saleId: 'sale-1',
        catalogItemId: 'source-item',
        catalogVariantId: null,
        itemNameSnapshot: 'Smoothing Curly',
        quantity: '1.0000',
        effectiveUnitPrice: '100000.0000',
        removedAt: null,
        fulfillment: { status: fulfillmentStatus },
        compositionComponents: [],
      },
    ],
  } as unknown as Sale;
}
const queued = () => sale('OPEN', 'WAITING', 'CASH', 'QUEUED');

type CorrectionPreview = (
  line: SaleLine,
  input: { lines: unknown[]; reason: string },
) => Promise<ReplaceLinePreview>;
const previewOf = (overrides: Partial<ReplaceLinePreview> = {}): ReplaceLinePreview => ({
  saleId: 'sale-1',
  saleVersion: 3,
  currency: 'IDR',
  currentTotalAmount: '100000.0000',
  correctedTotalAmount: '80000.0000',
  netSuccessfulPaidAmount: '80000.0000',
  remainingPaymentAmount: '0.0000',
  replacements: [],
  ...overrides,
});

function renderDialog(
  options: {
    sale?: Sale;
    canAdjust?: boolean;
    canRefundPayment?: boolean;
    correctResult?: Sale;
    items?: CatalogItem[];
    compensateResult?: Sale;
    compensateError?: Error;
    preview?: ReplaceLinePreview;
    previewError?: Error;
    correctError?: Error;
    candidates?: ComponentCandidate[];
    employees?: Array<{ id: string; displayName: string }>;
  } = {},
) {
  const onAdd = vi.fn<(item: CatalogItem, configuration: unknown) => Promise<unknown>>(
    async () => undefined,
  );
  const onQuantity = vi.fn();
  const onRemove = vi.fn();
  const onEdit = vi.fn(async () => options.correctResult);
  const onPreview = vi.fn<CorrectionPreview>(async () => options.preview ?? previewOf());
  const onCompensate = vi.fn(async () => {
    if (options.compensateError) throw options.compensateError;
    return options.compensateResult;
  });
  const onCorrect = vi.fn(async () => {
    if (options.correctError) throw options.correctError;
    return options.correctResult;
  });
  if (options.previewError) onPreview.mockRejectedValue(options.previewError);
  const loadConfiguratorState = vi.fn(async (item: CatalogItem) => {
    const variants = item.variants ?? [];
    return {
      item,
      variants,
      itemPrice: variants.length ? null : '100000.0000',
      pricesByVariantId: Object.fromEntries(variants.map((entry) => [entry.id, '150000.0000'])),
      // Same shape the POS menu receives: only a Product has Runtime-eligible salespeople.
      ...(item.type === 'PRODUCT'
        ? {
            salespeople: [
              { id: 'emp-andini', name: 'Andini' },
              { id: 'emp-heru', name: 'Pak Heru' },
            ],
          }
        : {}),
      // A Service's additions are performed by Service performers, never sold by anyone.
      ...(item.type === 'SERVICE'
        ? {
            componentPerformers: [
              { id: 'emp-andini', name: 'Andini' },
              { id: 'emp-heru', name: 'Pak Heru' },
              { id: 'emp-rindu', name: 'Rindu' },
            ],
          }
        : {}),
      locale: 'id-ID',
      currency: 'IDR',
    };
  });
  const loadCandidates = vi.fn(async () => ({ items: options.candidates ?? [] }));
  const tree = (current: Sale) => (
    <DeploymentBootstrapProvider config={bootstrap}>
      <QueryClientProvider client={new QueryClient()}>
        <DToastProvider>
          <ReferenceOrderAdjustmentDialog
            sale={current}
            items={options.items ?? items}
            locale="id-ID"
            isMutating={false}
            onClose={vi.fn()}
            onAdd={onAdd}
            onQuantity={onQuantity}
            onRemove={onRemove}
            onEdit={onEdit}
            onCorrect={onCorrect}
            onPreview={onPreview}
            loadConfiguratorState={loadConfiguratorState}
            loadCandidates={loadCandidates}
            canAdjust={options.canAdjust ?? true}
            canRefundPayment={options.canRefundPayment ?? false}
            onCompensate={onCompensate}
            employees={(options.employees ?? []) as never}
          />
        </DToastProvider>
      </QueryClientProvider>
    </DeploymentBootstrapProvider>
  );
  const view = render(tree(options.sale ?? sale()));
  return {
    /** Rerenders with the Sale Runtime returned after a command, as the workspace does. */
    showSale: (next: Sale) => view.rerender(tree(next)),
    onAdd,
    onQuantity,
    onRemove,
    onEdit,
    onPreview,
    onCompensate,
    onCorrect,
    loadConfiguratorState,
    ...view,
  };
}

function correctedSale(method: 'CASH' | 'BANK_TRANSFER' = 'CASH') {
  return { ...sale('OPEN', 'IN_PROGRESS', method), version: 4, totalAmount: '80000.0000' } as Sale;
}

function compensatedSale() {
  const base = correctedSale();
  return {
    ...base,
    version: 5,
    payments: [
      ...base.payments,
      {
        id: 'refund-1',
        status: 'SUCCEEDED',
        method: 'CASH',
        appliedAmount: '-20000.0000',
        tenderedAmount: null,
        changeAmount: null,
      },
    ],
  } as unknown as Sale;
}

/** Types into an item autocomplete and returns the text of every compact suggestion. */
async function suggestions(field: string, text: string) {
  const input = screen.getByRole('combobox', { name: field });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  // Suggestions are searched asynchronously; let that search settle before reading them.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(screen.queryAllByRole('option').length).toBeGreaterThan(0));
  return screen.getAllByRole('option').map((option) => option.textContent ?? '');
}

async function choose(field: string, text: string, option: RegExp) {
  await suggestions(field, text);
  fireEvent.click(screen.getByRole('option', { name: option }));
}

/**
 * Opens the correction. The current item is already selected and configured from the line; a
 * different Catalog item is chosen in the autocomplete only when `replacement` is given.
 */
async function openCorrection(
  replacement?: { query: string; option: RegExp },
  reason = 'Salah pilih layanan',
  lineName = 'Smoothing Curly',
) {
  fireEvent.click(screen.getByRole('button', { name: `Koreksi item ${lineName}` }));
  if (replacement) await choose('Item koreksi', replacement.query, replacement.option);
  await screen.findByRole('textbox', { name: 'Jumlah' });
  // A different item with variants starts fresh, so its variant is chosen like at the counter.
  const variants = screen.queryByRole('region', { name: 'Pilih varian' });
  if (
    replacement &&
    variants &&
    !within(variants)
      .getAllByRole('button')
      .some((button) => button.getAttribute('aria-pressed') === 'true')
  )
    fireEvent.click(within(variants).getAllByRole('button')[0]!);
  if (!reason) return;
  fireEvent.change(screen.getByLabelText('Alasan koreksi'), { target: { value: reason } });
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Lihat dampak' }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
}

async function previewAndConfirm() {
  await openCorrection();
  fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
  await screen.findByLabelText('Dampak koreksi');
  fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi koreksi' }));
}

describe('ReferenceOrderAdjustmentDialog — adding a new item', () => {
  afterEach(cleanup);

  const addDialog = () => screen.getByRole('dialog', { name: 'Tambahkan item' });

  it('opens one compact dialog with the autocomplete first and no catalog grid', () => {
    renderDialog({ sale: queued() });
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
    const dialog = addDialog();
    expect(within(dialog).getByRole('combobox', { name: 'Cari produk atau layanan' })).toBeTruthy();
    // Nothing to configure, and nothing to add, before an item is chosen.
    expect(within(dialog).queryByRole('textbox', { name: 'Jumlah' })).toBeNull();
    expect(
      (within(dialog).getByRole('button', { name: 'Tambahkan ke pesanan' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    // No card grid and no Product/Service segment of the POS catalog.
    for (const name of [/^Tambah Hair Color/, 'Produk', 'Layanan', 'Semua'])
      expect(within(dialog).queryByRole('button', { name })).toBeNull();
  });

  it('finds Services and Products alike, with compact suggestions, never a COMPONENT_ONLY Product', async () => {
    renderDialog({ sale: queued() });
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
    expect(await suggestions('Cari produk atau layanan', 'hair')).toEqual([
      'Hair ColorRPL · Layanan',
    ]);
    expect(await suggestions('Cari produk atau layanan', 'shampoo')).toEqual([
      'Shampoo PremiumSHP · Produk',
    ]);
    expect(await suggestions('Cari produk atau layanan', 'r')).not.toContain(
      expect.stringContaining('Resin Komponen'),
    );
  });

  it('matches by item code and by active variant, as the selling catalog does', async () => {
    renderDialog({ sale: queued() });
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
    expect(await suggestions('Cari produk atau layanan', 'rpl')).toEqual([
      'Hair ColorRPL · Layanan',
    ]);
    expect(await suggestions('Cari produk atau layanan', '500ml')).toEqual([
      'Shampoo PremiumSHP · Produk',
    ]);
  });

  it.each([
    { kind: 'a Product', query: 'shampoo', option: /Shampoo Premium/, id: 'shampoo' },
    { kind: 'a Service', query: 'hair', option: /Hair Color/, id: 'replacement-item' },
  ])(
    'configures $kind in the shared configuration below, then adds it on confirm',
    async ({ query, option, id }) => {
      const view = renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
      fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
      await choose('Cari produk atau layanan', query, option);
      const quantity = await within(addDialog()).findByRole('textbox', { name: 'Jumlah' });
      // An item with variants is configured like at the counter: its variant is chosen first.
      const variants = within(addDialog()).queryByRole('region', { name: 'Pilih varian' });
      if (variants) fireEvent.click(within(variants).getAllByRole('button')[0]!);
      expect(view.loadConfiguratorState).toHaveBeenCalledWith(expect.objectContaining({ id }));
      // Choosing only selects what to configure; nothing is added yet.
      expect(view.onAdd).not.toHaveBeenCalled();
      fireEvent.change(quantity, { target: { value: '2' } });
      // No correction reason and no impact step: nothing is being replaced.
      expect(screen.queryByLabelText('Alasan koreksi')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Lihat dampak' })).toBeNull();
      const add = within(addDialog()).getByRole('button', { name: 'Tambahkan ke pesanan' });
      await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(add);
      await waitFor(() => expect(view.onAdd).toHaveBeenCalledTimes(1));
      expect(view.onAdd.mock.calls[0]).toEqual([
        expect.objectContaining({ id }),
        expect.objectContaining({ quantity: '2' }),
      ]);
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Tambahkan item' })).toBeNull(),
      );
    },
  );

  it('starts a fresh configuration when a different item is chosen', async () => {
    renderDialog({ sale: queued() });
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
    await choose('Cari produk atau layanan', 'hair', /Hair Color/);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Jumlah' }), {
      target: { value: '4' },
    });
    await choose('Cari produk atau layanan', 'smoothing', /Smoothing Curly/);
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: 'Jumlah' }) as HTMLInputElement).value).toBe('1'),
    );
  });

  it('keeps the dialog open with plain guidance when Runtime refuses the addition', async () => {
    const view = renderDialog({ sale: queued() });
    view.onAdd.mockRejectedValueOnce(new Error('SALE_LINE_NOT_MUTABLE'));
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
    await choose('Cari produk atau layanan', 'hair', /Hair Color/);
    const add = within(addDialog()).getByRole('button', { name: 'Tambahkan ke pesanan' });
    await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(add);
    expect(
      await within(addDialog()).findByText(/Muat ulang transaksi lalu coba lagi/),
    ).toBeTruthy();
    expect(screen.queryByText(/SALE_LINE_NOT_MUTABLE/)).toBeNull();
  });

  it('cannot add anything without the adjustment permission', () => {
    const view = renderDialog({ sale: sale('OPEN', 'IN_PROGRESS'), canAdjust: false });
    const add = screen.getByRole('button', { name: 'Tambahkan item' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.click(add);
    expect(screen.queryByRole('dialog', { name: 'Tambahkan item' })).toBeNull();
    expect(view.onAdd).not.toHaveBeenCalled();
  });
});

describe('ReferenceOrderAdjustmentDialog — ordinary edit before work starts', () => {
  afterEach(cleanup);

  it('keeps quantity, removal and an item edit for a not-yet-started line, without correction', () => {
    const view = renderDialog({ sale: queued() });
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    expect(view.onQuantity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'source-line' }),
      '2.0000',
    );
    fireEvent.click(screen.getByRole('button', { name: /Hapus Smoothing Curly/ }));
    expect(view.onRemove).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Koreksi item/ })).toBeNull();
  });

  it('edits the line in the shared item configuration and saves it with no reason or impact preview', async () => {
    const view = renderDialog({ sale: queued() });
    fireEvent.click(screen.getByRole('button', { name: 'Ubah item Smoothing Curly' }));
    const quantityInput = await screen.findByRole('textbox', { name: 'Jumlah' });
    fireEvent.change(quantityInput, { target: { value: '2' } });
    expect(screen.queryByLabelText('Alasan koreksi')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lihat dampak' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Simpan perubahan/ }));
    await waitFor(() => expect(view.onEdit).toHaveBeenCalledTimes(1));
    expect(view.onEdit.mock.calls[0]).toEqual([
      expect.objectContaining({ id: 'source-line' }),
      { lines: [{ catalogItemId: 'source-item', quantity: '2' }] },
    ]);
    expect(view.onCorrect).not.toHaveBeenCalled();
  });

  it('turns every mutating control off when the session may not adjust this Sale', () => {
    renderDialog({ sale: queued(), canAdjust: false });
    for (const name of [
      /Tambah jumlah Smoothing Curly/,
      /Hapus Smoothing Curly/,
      /Ubah item Smoothing Curly/,
    ])
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    // Closing stays possible.
    expect(
      (screen.getByRole('button', { name: 'Simpan penyesuaian' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

describe('ReferenceOrderAdjustmentDialog — IN_PROGRESS correction', () => {
  afterEach(cleanup);

  it('offers Koreksi item for an IN_PROGRESS line and no direct quantity, removal or edit', () => {
    renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
    expect(
      (screen.getByRole('button', { name: 'Koreksi item Smoothing Curly' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    for (const name of [/Tambah jumlah/, /Kurangi jumlah/, /Hapus Smoothing Curly/, /Ubah item/])
      expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('routes every existing line of an IN_PROGRESS Sale through the correction, even one still waiting', () => {
    renderDialog({ sale: sale('OPEN', 'WAITING') });
    expect(screen.getByRole('button', { name: 'Koreksi item Smoothing Curly' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Hapus Smoothing Curly/ })).toBeNull();
  });

  it('disables the correction for a session without the progressed permission', () => {
    renderDialog({ sale: sale('OPEN', 'IN_PROGRESS'), canAdjust: false });
    expect(
      (screen.getByRole('button', { name: 'Koreksi item Smoothing Curly' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('changes the Catalog item through the same autocomplete, Service → Product, with no grid', async () => {
    const view = renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi item Smoothing Curly' }));
    expect(
      screen.getByText('Pekerjaan yang sudah berjalan tetap tercatat pada item ini.'),
    ).toBeTruthy();
    // The current item is selected from the start.
    expect((screen.getByRole('combobox', { name: 'Item koreksi' }) as HTMLInputElement).value).toBe(
      'Smoothing Curly',
    );
    await openCorrection({ query: 'shampoo', option: /Shampoo Premium/ }, 'Salah pilih layanan');
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    await screen.findByLabelText('Dampak koreksi');
    expect(view.onPreview.mock.calls[0]![1]).toEqual({
      lines: [{ catalogItemId: 'shampoo', catalogVariantId: 'v-500', quantity: '1' }],
      reason: 'Salah pilih layanan',
    });
  });

  it('corrects Product → Service as well', async () => {
    const productLine = {
      ...sale('OPEN', 'IN_PROGRESS'),
      lines: [
        {
          id: 'source-line',
          saleId: 'sale-1',
          catalogItemId: 'shampoo',
          catalogVariantId: null,
          itemNameSnapshot: 'Smoothing Curly',
          quantity: '1.0000',
          effectiveUnitPrice: '50000.0000',
          removedAt: null,
          fulfillment: null,
          compositionComponents: [],
        },
      ],
    } as unknown as Sale;
    const view = renderDialog({ sale: productLine });
    await openCorrection({ query: 'hair', option: /Hair Color/ });
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    await screen.findByLabelText('Dampak koreksi');
    expect(view.onPreview.mock.calls[0]![1]).toEqual({
      lines: [{ catalogItemId: 'replacement-item', quantity: '1' }],
      reason: 'Salah pilih layanan',
    });
  });

  it('starts from the current item and its configuration; a different item starts fresh', async () => {
    renderDialog({
      sale: {
        ...sale('OPEN', 'IN_PROGRESS'),
        lines: [{ ...sale().lines[0]!, quantity: '3.0000' }],
      } as Sale,
    });
    await openCorrection();
    expect((screen.getByRole('textbox', { name: 'Jumlah' }) as HTMLInputElement).value).toBe('3');
    await choose('Item koreksi', 'hair', /Hair Color/);
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: 'Jumlah' }) as HTMLInputElement).value).toBe('1'),
    );
  });

  const colorLine = (overrides: object = {}) =>
    ({
      ...sale('OPEN', 'IN_PROGRESS'),
      lines: [
        {
          ...sale().lines[0]!,
          catalogItemId: 'color',
          catalogVariantId: 'red',
          itemNameSnapshot: 'Color Treatment',
          variantNameSnapshot: 'Red',
          ...overrides,
        },
      ],
    }) as unknown as Sale;
  const variantChoice = (name: string) =>
    within(screen.getByRole('region', { name: 'Pilih varian' })).getByRole('button', {
      name: new RegExp(name),
    });

  it('corrects only the variant of the same item, Red → Blue, without searching again', async () => {
    const view = renderDialog({ sale: colorLine() });
    await openCorrection(undefined, 'Salah warna', 'Color Treatment');
    expect((screen.getByRole('combobox', { name: 'Item koreksi' }) as HTMLInputElement).value).toBe(
      'Color Treatment',
    );
    expect(variantChoice('Red').getAttribute('aria-pressed')).toBe('true');
    expect(view.loadConfiguratorState).toHaveBeenCalledTimes(1);
    fireEvent.click(variantChoice('Blue'));
    expect(variantChoice('Blue').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    await screen.findByLabelText('Dampak koreksi');
    expect(view.onPreview.mock.calls[0]![1]).toEqual({
      lines: [{ catalogItemId: 'color', catalogVariantId: 'blue', quantity: '1' }],
      reason: 'Salah warna',
    });
    // Confirming still needs the reason, which is kept.
    expect(
      (screen.getByRole('button', { name: 'Konfirmasi koreksi' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    fireEvent.change(screen.getByLabelText('Alasan koreksi'), { target: { value: ' ' } });
    expect(
      (screen.getByRole('button', { name: 'Konfirmasi koreksi' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('corrects only the quantity of the same item and variant', async () => {
    const view = renderDialog({ sale: colorLine() });
    await openCorrection(undefined, 'Tambah satu', 'Color Treatment');
    fireEvent.change(screen.getByRole('textbox', { name: 'Jumlah' }), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    await screen.findByLabelText('Dampak koreksi');
    expect(view.onPreview.mock.calls[0]![1]).toEqual({
      lines: [{ catalogItemId: 'color', catalogVariantId: 'red', quantity: '2' }],
      reason: 'Tambah satu',
    });
  });

  it('keeps the chosen additions of the same item and lets them be changed', async () => {
    const serum: ComponentCandidate = {
      id: 'serum',
      code: 'SRM',
      name: 'Serum',
      productUsage: 'STANDALONE_AND_COMPONENT',
      variantSelectionMode: 'OPTIONAL',
      resolvedPrice: {
        catalogPriceId: 'p-serum',
        catalogItemId: 'serum',
        catalogVariantId: null,
        locationId: null,
        currency: 'IDR',
        amount: '5000.0000',
      },
      variants: [],
    } as unknown as ComponentCandidate;
    const view = renderDialog({
      candidates: [serum],
      sale: colorLine({
        compositionComponents: [
          {
            componentSource: 'SALE_SELECTED',
            componentItemId: 'serum',
            componentVariantId: null,
            itemNameSnapshot: 'Serum',
            variantNameSnapshot: null,
            quantity: '1.0000',
            transactionUnitPrice: '5000.0000',
          },
        ],
      }),
    });
    await openCorrection(undefined, 'Ganti tambahan', 'Color Treatment');
    // The line's own addition starts selected.
    expect(
      screen.getByRole('switch', { name: /Gunakan item tambahan/ }).getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('switch', { name: /Gunakan item tambahan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    await screen.findByLabelText('Dampak koreksi');
    expect(view.onPreview.mock.calls[0]![1]).toEqual({
      lines: [{ catalogItemId: 'color', catalogVariantId: 'red', quantity: '1' }],
      reason: 'Ganti tambahan',
    });
  });

  it('shows a lower corrected total as the Runtime refund, not as a failure', async () => {
    renderDialog({
      preview: previewOf({
        correctedTotalAmount: '60000.0000',
        netSuccessfulPaidAmount: '100000.0000',
        remainingPaymentAmount: '0.0000',
        refundAmount: '40000.0000',
      }),
    });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    const impact = await screen.findByLabelText('Dampak koreksi');
    expect(impact.textContent).toContain('Dikembalikan ke pelanggan');
    expect(impact.textContent).toContain('40.000');
    expect(impact.textContent).not.toContain('Sisa pembayaran');
  });

  it('names a missing reason from Runtime instead of a generic failure', async () => {
    const { ApiError } = await import('@digvation/pos-api');
    renderDialog({ previewError: new ApiError(409, 'SALE_CORRECTION_REASON_REQUIRED', 'reason') });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(await screen.findByText('Isi alasan koreksi.')).toBeTruthy();
  });

  it('requires a reason before the Runtime impact and before confirming', async () => {
    renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
    await openCorrection(undefined, '');
    expect(
      (screen.getByRole('button', { name: 'Lihat dampak' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Konfirmasi koreksi' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText('Alasan koreksi'), {
      target: { value: 'Salah layanan' },
    });
    expect(
      (screen.getByRole('button', { name: 'Lihat dampak' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    // Preview stays a fresh requirement before confirmation.
    expect(
      (screen.getByRole('button', { name: 'Konfirmasi koreksi' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Kembali' }));
    expect(screen.queryByText('Item saat ini')).toBeNull();
  });

  it('previews the remaining balance from Runtime, never a predicted overpayment, and offers no compensation before saving', async () => {
    const view = renderDialog({
      canRefundPayment: true,
      correctResult: correctedSale(),
      preview: previewOf({
        remainingPaymentAmount: '25000.0000',
        netSuccessfulPaidAmount: '55000.0000',
      }),
    });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(await screen.findByText('Sisa pembayaran')).toBeTruthy();
    expect(screen.queryByText('Kelebihan pembayaran')).toBeNull();
    expect(view.onCompensate).not.toHaveBeenCalled();
  });

  it('shows the Runtime-calculated replacement lines and totals in the impact, not a Web calculation', async () => {
    renderDialog({
      preview: previewOf({
        correctedTotalAmount: '425000.0000',
        replacements: [
          {
            catalogItemId: 'i',
            itemName: 'Smoothing Curly',
            variantName: 'Curly',
            quantity: '1.0000',
            unitAmount: '210000.0000',
            grossAmount: '210000.0000',
            additions: [
              {
                name: 'Addition A',
                quantity: '1.0000',
                unitPrice: '25000.0000',
                amount: '25000.0000',
              },
            ],
          },
          {
            catalogItemId: 'i',
            itemName: 'Smoothing Curly',
            variantName: 'Curly',
            quantity: '1.0000',
            unitAmount: '215000.0000',
            grossAmount: '215000.0000',
            additions: [
              {
                name: 'Addition B',
                quantity: '1.0000',
                unitPrice: '30000.0000',
                amount: '30000.0000',
              },
            ],
          },
        ],
      }),
    });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    const impact = await screen.findByLabelText('Dampak koreksi');
    expect(impact.textContent).toContain('Addition A');
    expect(impact.textContent).toContain('425.000');
    expect(impact.textContent).not.toContain('212.500');
  });

  it('offers the shared per-unit configuration in a correction', async () => {
    renderDialog();
    await openCorrection();
    fireEvent.change(screen.getByRole('textbox', { name: 'Jumlah' }), { target: { value: '2' } });
    expect(screen.getByRole('list', { name: 'Unit' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /Gunakan item tambahan/ })).toBeTruthy();
  });

  it('confirms the correction first, then offers the cash return from the persisted Sale and refreshes the settlement', async () => {
    const view = renderDialog({
      canRefundPayment: true,
      correctResult: correctedSale(),
      compensateResult: compensatedSale(),
    });
    await previewAndConfirm();
    expect(await screen.findByText('Koreksi tersimpan.')).toBeTruthy();
    expect(view.onCorrect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'source-line' }),
      expect.objectContaining({ reason: 'Salah pilih layanan' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Kembalikan kelebihan pembayaran' }));
    expect(view.onCompensate).toHaveBeenCalledWith(
      expect.objectContaining({ version: 4 }),
      'payment-1',
      '20000.0000',
    );
    expect(await screen.findByText('Pembayaran sudah sesuai')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Selesai' }));
    expect(screen.queryByText('Koreksi tersimpan.')).toBeNull();
  });

  it('explains missing refund permission and provider confirmation from the persisted Sale, without raw Runtime codes', async () => {
    const noPermission = renderDialog({ canRefundPayment: false, correctResult: correctedSale() });
    await previewAndConfirm();
    expect(
      await screen.findByText(
        'Pengembalian dana memerlukan pengguna dengan izin pengembalian pembayaran.',
      ),
    ).toBeTruthy();
    noPermission.unmount();
    renderDialog({
      sale: sale('OPEN', 'IN_PROGRESS', 'BANK_TRANSFER'),
      canRefundPayment: true,
      correctResult: correctedSale('BANK_TRANSFER'),
    });
    await previewAndConfirm();
    expect(
      await screen.findByText(
        'Pengembalian pembayaran ini memerlukan konfirmasi dari penyedia pembayaran.',
      ),
    ).toBeTruthy();
  });

  it('names what is missing instead of a generic preview failure, and keeps a safe fallback for unknown errors', async () => {
    const { ApiError } = await import('@digvation/pos-api');
    renderDialog({ previewError: new ApiError(404, 'CATALOG_ITEM_NOT_FOUND', 'gone') });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(await screen.findByText('Item pengganti tidak lagi tersedia.')).toBeTruthy();
    cleanup();
    renderDialog({ previewError: new Error('boom') });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(
      await screen.findByText(
        'Koreksi tidak dapat dipratinjau. Muat ulang transaksi lalu coba lagi.',
      ),
    ).toBeTruthy();
  });

  it('labels a replacement with its Runtime correction lineage', () => {
    const base = sale('OPEN', 'IN_PROGRESS');
    const source = { ...base.lines[0]!, removedAt: '2026-10-01T09:00:00.000Z' };
    const replacement = {
      ...base.lines[0]!,
      id: 'replacement-line',
      catalogItemId: 'replacement-item',
      itemNameSnapshot: 'Hair Color',
      fulfillment: { status: 'WAITING' },
      correctedFromLineId: 'source-line',
    };
    renderDialog({ sale: { ...base, lines: [source, replacement] } as unknown as Sale });
    expect(screen.getByText(/Koreksi dari Smoothing Curly/).textContent).toContain(
      'pekerjaan awal tetap tercatat',
    );
  });
});

describe('ReferenceOrderAdjustmentDialog — completed work', () => {
  afterEach(cleanup);

  it('never offers a COMPLETED line for correction or direct change, whatever the permission, with plain guidance', () => {
    renderDialog({ sale: sale('OPEN', 'COMPLETED'), canAdjust: true });
    expect(screen.queryByRole('button', { name: /Koreksi item/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Hapus Smoothing Curly/ })).toBeNull();
    expect(
      screen.getByText('Item yang sudah selesai dikerjakan tidak dapat dikoreksi.'),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/SALE_LINE_NOT_MUTABLE|adjust-progressed/);
  });

  it('hides correction for a FINALIZED Sale', () => {
    renderDialog({ sale: sale('FINALIZED', 'COMPLETED') });
    expect(screen.queryByRole('button', { name: /Koreksi item/ })).toBeNull();
  });
});

describe('ReferenceOrderAdjustmentDialog — new Product upsell and its seller', () => {
  afterEach(cleanup);

  const field = () => screen.queryByLabelText('Dijual oleh', { selector: 'button' });
  const productLine = (id: string, overrides: object = {}) => ({
    ...sale().lines[0]!,
    id,
    catalogItemId: 'single',
    itemNameSnapshot: 'QA Item Tunggal',
    itemTypeSnapshot: 'PRODUCT',
    effectiveUnitPrice: '12000.0000',
    fulfillment: null,
    soldByEmployeeId: 'emp-andini',
    soldByEmployeeNameSnapshot: 'Andini',
    ...overrides,
  });

  it('offers "Dijual oleh" for a Product added to an IN_PROGRESS Sale and sends the chosen seller', async () => {
    const view = renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
    await choose('Cari produk atau layanan', 'qa item', /QA Item Tunggal/);
    await screen.findByRole('textbox', { name: 'Jumlah' });
    expect(field()).not.toBeNull();
    fireEvent.click(field()!);
    expect(await screen.findByRole('option', { name: 'Andini' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Pak Heru' })).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: 'Andini' }));
    const add = screen.getByRole('button', { name: 'Tambahkan ke pesanan' });
    await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(add);
    await waitFor(() => expect(view.onAdd).toHaveBeenCalledTimes(1));
    expect(view.onAdd.mock.calls[0]![1]).toMatchObject({
      soldBy: { employeeId: 'emp-andini', name: 'Andini' },
    });
  });

  it('never shows the Product seller for a Service', async () => {
    renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
    await choose('Cari produk atau layanan', 'hair', /Hair Color/);
    await screen.findByRole('textbox', { name: 'Jumlah' });
    expect(field()).toBeNull();
  });

  it('lets a Product just added to an IN_PROGRESS Sale be fixed directly, and shows its seller', async () => {
    const base = sale('OPEN', 'IN_PROGRESS');
    const view = renderDialog({ sale: base });
    // Runtime returns the Sale with the new Product after the addition.
    view.showSale({ ...base, lines: [...base.lines, productLine('added-line')] } as Sale);
    expect(screen.getByText('Dijual oleh Andini')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tambah jumlah QA Item Tunggal' }));
    expect(view.onQuantity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'added-line' }),
      '2.0000',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hapus QA Item Tunggal' }));
    expect(view.onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'added-line' }));
    // Not a correction: no Koreksi item for the new line.
    expect(screen.queryByRole('button', { name: 'Koreksi item QA Item Tunggal' })).toBeNull();
    // The historical in-progress line still goes through Koreksi item only.
    expect(screen.getByRole('button', { name: 'Koreksi item Smoothing Curly' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hapus Smoothing Curly' })).toBeNull();
  });

  it('decreases the quantity of a new Product through Runtime, never below one', () => {
    const base = sale('OPEN', 'IN_PROGRESS');
    const view = renderDialog({ sale: base });
    view.showSale({
      ...base,
      lines: [...base.lines, productLine('added-line', { quantity: '3.0000' })],
    } as Sale);
    fireEvent.click(screen.getByRole('button', { name: 'Kurangi jumlah QA Item Tunggal' }));
    expect(view.onQuantity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'added-line' }),
      '2.0000',
    );
    view.showSale({
      ...base,
      lines: [...base.lines, productLine('added-line', { quantity: '1.0000' })],
    } as Sale);
    expect(
      (screen.getByRole('button', { name: 'Kurangi jumlah QA Item Tunggal' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('changes the seller of a new Product through the ordinary item edit', async () => {
    const base = sale('OPEN', 'IN_PROGRESS');
    const view = renderDialog({ sale: base });
    view.showSale({ ...base, lines: [...base.lines, productLine('added-line')] } as Sale);
    fireEvent.click(screen.getByRole('button', { name: 'Ubah item QA Item Tunggal' }));
    await screen.findByRole('textbox', { name: 'Jumlah' });
    fireEvent.click(field()!);
    fireEvent.click(await screen.findByRole('option', { name: 'Pak Heru' }));
    fireEvent.click(screen.getByRole('button', { name: /^Simpan perubahan/ }));
    await waitFor(() => expect(view.onEdit).toHaveBeenCalledTimes(1));
    expect(view.onEdit.mock.calls[0]).toEqual([
      expect.objectContaining({ id: 'added-line' }),
      { lines: [{ catalogItemId: 'single', quantity: '1', soldByEmployeeId: 'emp-heru' }] },
    ]);
    expect(view.onCorrect).not.toHaveBeenCalled();
  });
});

describe('ReferenceOrderAdjustmentDialog — Service additional item work', () => {
  afterEach(cleanup);
  const serum = {
    id: 'serum',
    code: 'SRM',
    name: 'Red Coloring BRAND',
    productUsage: 'STANDALONE_AND_COMPONENT',
    variantSelectionMode: 'OPTIONAL',
    resolvedPrice: {
      catalogPriceId: 'p-serum',
      catalogItemId: 'serum',
      catalogVariantId: null,
      locationId: null,
      currency: 'IDR',
      amount: '10000.0000',
    },
    variants: [],
  } as unknown as ComponentCandidate;
  const employees = [
    { id: 'emp-andini', displayName: 'Andini' },
    { id: 'emp-heru', displayName: 'Pak Heru' },
    { id: 'emp-rindu', displayName: 'Rindu' },
  ];
  const performedLine = () =>
    ({
      ...sale('OPEN', 'IN_PROGRESS'),
      lines: [
        {
          ...sale().lines[0]!,
          itemNameSnapshot: 'Coloring Service',
          itemTypeSnapshot: 'SERVICE',
          soldByEmployeeId: null,
          soldByEmployeeNameSnapshot: null,
          compositionComponents: [
            {
              id: 'component-red',
              componentSource: 'SALE_SELECTED',
              componentItemId: 'serum',
              componentVariantId: null,
              itemNameSnapshot: 'Red Coloring BRAND',
              variantNameSnapshot: null,
              quantity: '1.0000',
              transactionUnitPrice: '10000.0000',
              extendedContribution: '10000.0000',
              performers: [
                { employeeId: 'emp-heru', shareRate: '0.5' },
                { employeeId: 'emp-rindu', shareRate: '0.5' },
              ],
            },
          ],
        },
      ],
    }) as unknown as Sale;

  it('shows who performs the addition, and no "Dijual oleh" for it', () => {
    renderDialog({ sale: performedLine(), employees });
    expect(screen.getByText('+ Red Coloring BRAND · Dikerjakan oleh Pak Heru, Rindu')).toBeTruthy();
    expect(screen.queryByText(/Dijual oleh/)).toBeNull();
  });

  it('prefills the correction with the addition and its performers, and sends them', async () => {
    const view = renderDialog({ sale: performedLine(), employees, candidates: [serum] });
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi item Coloring Service' }));
    // The source's performers come back as chips, named from the performer list.
    const work = await screen.findByRole('group', { name: 'Dikerjakan oleh' });
    expect(within(work).getByText('Pak Heru')).toBeTruthy();
    expect(within(work).getByText('Rindu')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Alasan koreksi'), { target: { value: 'Ganti warna' } });
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Lihat dampak' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    await screen.findByLabelText('Dampak koreksi');
    expect(view.onPreview.mock.calls[0]![1].lines).toEqual([
      {
        catalogItemId: 'source-item',
        quantity: '1',
        additionalComponents: [
          {
            componentItemId: 'serum',
            quantity: '1.0000',
            performers: [{ employeeId: 'emp-heru' }, { employeeId: 'emp-rindu' }],
          },
        ],
      },
    ]);
  });

  it('a different item starts without the source addition performers', async () => {
    const view = renderDialog({ sale: performedLine(), employees, candidates: [serum] });
    await openCorrection({ query: 'hair', option: /Hair Color/ }, 'Salah layanan', 'Coloring Service');
    expect(screen.queryByRole('group', { name: 'Dikerjakan oleh' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    await screen.findByLabelText('Dampak koreksi');
    expect(JSON.stringify(view.onPreview.mock.calls[0]![1])).not.toContain('performers');
  });
});
