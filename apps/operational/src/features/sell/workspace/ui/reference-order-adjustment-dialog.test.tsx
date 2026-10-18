import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation-labs/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  HttpCashierTransactionAdapter,
  type OrderAdjustmentCommitInput,
  type OrderAdjustmentInput,
  type OrderAdjustmentIssue,
  type OrderAdjustmentOperation,
  type OrderAdjustmentPreview,
  type OrderAdjustmentResult,
  type ReplaceLinePreview,
} from '../../transaction/api/cashier-transaction.adapter';
import type {
  CatalogItem,
  ComponentCandidate,
  PaymentRoute,
  Sale,
  SaleLine,
} from '../../transaction/model/cashier-transaction.types';
import { ReferenceOrderAdjustmentDialog } from '../../adjustment/reference-order-adjustment-dialog';

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
const people: Record<string, string> = {
  'emp-andini': 'Andini',
  'emp-heru': 'Pak Heru',
  'emp-rindu': 'Rindu',
};

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
        grossAmount: '100000.0000',
        removedAt: null,
        fulfillment: { status: fulfillmentStatus },
        compositionComponents: [],
      },
    ],
  } as unknown as Sale;
}
const queued = () => sale('OPEN', 'WAITING', 'CASH', 'QUEUED');

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

const amount = (value: number) => value.toFixed(4);

const route = (id: string, paymentMethod: string, financialAccountName: string) =>
  ({
    id,
    sellingLocationId: 'location-1',
    paymentMethod,
    currency: 'IDR',
    financialAccountId: `account-${id}`,
    financialAccountCode: null,
    financialAccountName,
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  }) as PaymentRoute;
/** The location's routes: a cash drawer, two bank accounts and a QRIS account. */
const routes = [
  route('route-cash', 'CASH', 'Kas Laci'),
  route('route-bca', 'BANK_TRANSFER', 'BCA Operasional'),
  route('route-mandiri', 'BANK_TRANSFER', 'Mandiri'),
  route('route-qris', 'QRIS', 'QRIS BRI'),
];

/**
 * A test-only stand-in for Runtime: applies the draft to the persisted Sale and classifies its
 * settlement. The dialog never prices anything itself; these figures only feed the UI under test.
 */
function fakeRuntimePreview(
  persisted: Sale,
  input: OrderAdjustmentInput,
  options: {
    impact?: ReplaceLinePreview;
    issues?: OrderAdjustmentIssue[];
    refundPermissionGranted?: boolean;
    voidPermissionGranted?: boolean;
  },
): OrderAdjustmentPreview {
  const lines = persisted.lines.map((line) => ({ ...line })) as SaleLine[];
  const origins: OrderAdjustmentPreview['lines'] = [];
  const created = (
    id: string,
    configured: {
      catalogItemId: string;
      catalogVariantId?: string;
      quantity: string;
      soldByEmployeeId?: string;
    },
    extra: Partial<SaleLine> = {},
  ) =>
    ({
      id,
      saleId: persisted.id,
      catalogItemId: configured.catalogItemId,
      catalogVariantId: configured.catalogVariantId ?? null,
      itemNameSnapshot: items.find((item) => item.id === configured.catalogItemId)?.name ?? '',
      itemTypeSnapshot: items.find((item) => item.id === configured.catalogItemId)?.type,
      quantity: amount(Number(configured.quantity)),
      effectiveUnitPrice: '10000.0000',
      grossAmount: amount(Number(configured.quantity) * 10000),
      removedAt: null,
      fulfillment: null,
      compositionComponents: [],
      soldByEmployeeId: configured.soldByEmployeeId ?? null,
      soldByEmployeeNameSnapshot: configured.soldByEmployeeId
        ? (people[configured.soldByEmployeeId] ?? null)
        : null,
      ...extra,
    }) as unknown as SaleLine;
  input.operations.forEach((operation) => {
    if (operation.kind === 'ADD')
      operation.lines.forEach((configured, index) => {
        const id = `${operation.clientKey}-${index}`;
        lines.push(created(id, configured));
        origins.push({ lineId: id, clientKey: operation.clientKey, replacesLineId: null });
      });
    else {
      const line = lines.find((entry) => entry.id === operation.lineId)!;
      if (operation.kind === 'QUANTITY') Object.assign(line, { quantity: operation.quantity });
      else Object.assign(line, { removedAt: '2026-10-08T00:00:00.000Z' });
      if (operation.kind === 'REPLACE') {
        const impact = options.impact?.replacements ?? [];
        operation.lines.forEach((configured, index) => {
          const id = `${operation.lineId}-replacement-${index}`;
          const known = impact[index];
          lines.push(
            created(id, configured, {
              correctedFromLineId: operation.lineId,
              ...(known
                ? {
                    itemNameSnapshot: known.itemName,
                    variantNameSnapshot: known.variantName,
                    quantity: known.quantity,
                    effectiveUnitPrice: known.unitAmount,
                    grossAmount: known.grossAmount,
                    compositionComponents: known.additions.map((addition) => ({
                      componentSource: 'SALE_SELECTED',
                      itemNameSnapshot: addition.name,
                      variantNameSnapshot: null,
                      quantity: addition.quantity,
                      transactionUnitPrice: addition.unitPrice,
                      extendedContribution: addition.amount,
                    })),
                  }
                : {}),
            } as Partial<SaleLine>),
          );
          origins.push({ lineId: id, clientKey: null, replacesLineId: operation.lineId });
        });
      }
    }
  });
  const active = lines.filter((line) => !line.removedAt);
  const total =
    options.impact?.correctedTotalAmount ??
    amount(
      active.reduce(
        (sum, line) => sum + Number(line.quantity) * Number(line.effectiveUnitPrice),
        0,
      ),
    );
  const paid =
    options.impact?.netSuccessfulPaidAmount ??
    amount(
      persisted.payments
        .filter((payment) => payment.status === 'SUCCEEDED')
        .reduce((sum, payment) => sum + Number(payment.appliedAmount), 0),
    );
  const difference = Number(total) - Number(paid);
  // No active line left: Runtime voids the Sale and returns everything paid.
  const voidRequired = active.length === 0;
  const consequence = voidRequired
    ? 'VOID_REQUIRED'
    : difference > 0
      ? 'ADDITIONAL_PAYMENT_REQUIRED'
      : difference < 0
        ? 'REFUND_REQUIRED'
        : 'SETTLED';
  const refund = voidRequired ? Number(paid) : Math.max(-difference, 0);
  // Runtime's attribution: the newest successful payment first, whatever its method.
  let left = refund;
  const refundSources = persisted.payments
    .filter((payment) => payment.status === 'SUCCEEDED')
    .slice()
    .reverse()
    .flatMap((payment) => {
      const portion = Math.min(Number(payment.appliedAmount), left);
      left -= portion;
      return portion > 0
        ? [{ sourcePaymentId: payment.id, method: payment.method, amount: amount(portion) }]
        : [];
    });
  const issues: OrderAdjustmentIssue[] = [
    ...(options.issues ?? []),
    ...(voidRequired && options.voidPermissionGranted === false
      ? [{ operationIndex: null, code: 'SALE_VOID_FORBIDDEN', message: 'void' }]
      : []),
    ...(refund > 0 && options.refundPermissionGranted === false
      ? [
          {
            operationIndex: null,
            code: 'PAYMENT_REFUND_FORBIDDEN',
            message: 'Returning money requires the payment refund permission',
          },
        ]
      : []),
  ];
  return {
    saleId: persisted.id,
    saleVersion: persisted.version,
    currency: 'IDR',
    current: {
      totalAmount: options.impact?.currentTotalAmount ?? persisted.totalAmount,
      paidAmount: paid,
      remainingAmount: '0.0000',
    },
    proposedSale: { ...persisted, lines, totalAmount: voidRequired ? '0.0000' : total } as Sale,
    lines: [
      ...active
        .filter((line) => !origins.some((origin) => origin.lineId === line.id))
        .map((line) => ({ lineId: line.id, clientKey: null, replacesLineId: null })),
      ...origins,
    ],
    settlement: {
      consequence,
      amount: voidRequired ? amount(refund) : amount(Math.abs(difference)),
      remainingAfter: voidRequired ? '0.0000' : amount(Math.max(difference, 0)),
      refundAmount: amount(refund),
      refundRequired: refund > 0,
      refundSupported: true,
      refundCapacityAmount: paid,
      refundSources,
      refundDisbursementRequired: refund > 0,
      refundPermissionRequired: refund > 0,
      refundPermissionGranted: options.refundPermissionGranted ?? true,
      voidRequired,
      voidPermissionGranted: options.voidPermissionGranted ?? true,
      refund: null,
    },
    issues,
    commitAllowed: issues.length === 0,
  };
}

type CommitInput = OrderAdjustmentCommitInput;
type PreviewFn = (
  saleId: string,
  input: OrderAdjustmentInput,
  signal?: AbortSignal,
) => Promise<OrderAdjustmentPreview>;
type CommitFn = (
  saleId: string,
  input: CommitInput,
  idempotencyKey: string,
) => Promise<OrderAdjustmentResult>;

function renderDialog(
  options: {
    sale?: Sale;
    canAdjust?: boolean;
    refundPermissionGranted?: boolean;
    voidPermissionGranted?: boolean;
    paymentRoutes?: PaymentRoute[];
    items?: CatalogItem[];
    impact?: ReplaceLinePreview;
    previewError?: Error;
    issues?: OrderAdjustmentIssue[];
    candidates?: ComponentCandidate[];
    employees?: Array<{ id: string; displayName: string }>;
  } = {},
) {
  const persisted = options.sale ?? sale();
  const onPreview = vi.fn<PreviewFn>(async (...[, input]: Parameters<PreviewFn>) => {
    if (options.previewError) throw options.previewError;
    return fakeRuntimePreview(persisted, input, options);
  });
  const onCommit = vi.fn<CommitFn>(async (...[, input]: Parameters<CommitFn>) => {
    const reviewed = fakeRuntimePreview(persisted, input, options);
    return {
      adjustmentId: 'adjustment-1',
      sale: {
        ...reviewed.proposedSale,
        ...(reviewed.settlement.voidRequired ? { status: 'VOIDED' as const } : {}),
        version: persisted.version + 1,
      },
      lines: reviewed.lines,
      settlement: reviewed.settlement,
    };
  });
  const onCommitted = vi.fn();
  const onReload = vi.fn(async () => ({ ...persisted, version: persisted.version + 1 }) as Sale);
  const onClose = vi.fn();
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
  const tree = (current: Sale | null) => (
    <DeploymentBootstrapProvider config={bootstrap}>
      <QueryClientProvider client={new QueryClient()}>
        <DToastProvider>
          <ReferenceOrderAdjustmentDialog
            key={current?.id ?? 'closed'}
            sale={current}
            items={options.items ?? items}
            locale="id-ID"
            isMutating={false}
            onClose={onClose}
            onPreview={onPreview}
            onCommit={onCommit}
            onCommitted={onCommitted}
            onReload={onReload}
            loadConfiguratorState={loadConfiguratorState}
            loadCandidates={loadCandidates}
            canAdjust={options.canAdjust ?? true}
            paymentRoutes={options.paymentRoutes ?? routes}
            employees={(options.employees ?? []) as never}
          />
        </DToastProvider>
      </QueryClientProvider>
    </DeploymentBootstrapProvider>
  );
  const view = render(tree(persisted));
  return {
    persisted,
    onPreview,
    onCommit,
    onCommitted,
    onReload,
    onClose,
    loadConfiguratorState,
    /** Closes the dialog and opens a fresh one, as the workspace does after Batal. */
    reopen: () => {
      view.rerender(tree(null));
      view.rerender(tree(persisted));
    },
    /** The draft the dialog most recently asked Runtime to preview. */
    draft: () => onPreview.mock.calls.at(-1)?.[1].operations ?? [],
    /** The correction (REPLACE) of a preview call, as the correction dialog proposed it. */
    replaceOf: (call = 0) => {
      const operation = onPreview.mock.calls[call]![1].operations.find(
        (entry: OrderAdjustmentOperation) => entry.kind === 'REPLACE',
      ) as Extract<OrderAdjustmentOperation, { kind: 'REPLACE' }>;
      return { lines: operation.lines, reason: operation.reason };
    },
    ...view,
  };
}

const save = () => screen.getByRole('button', { name: 'Simpan penyesuaian' }) as HTMLButtonElement;
const cancel = () => screen.getByRole('button', { name: 'Batal' }) as HTMLButtonElement;
const impact = () => screen.findByLabelText('Dampak penyesuaian');

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

async function addThroughDialog(query: string, option: RegExp, quantity?: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
  await choose('Cari produk atau layanan', query, option);
  const dialog = screen.getByRole('dialog', { name: 'Tambahkan item' });
  const field = await within(dialog).findByRole('textbox', { name: 'Jumlah' });
  const variants = within(dialog).queryByRole('region', { name: 'Pilih varian' });
  if (variants) fireEvent.click(within(variants).getAllByRole('button')[0]!);
  if (quantity) fireEvent.change(field, { target: { value: quantity } });
  const add = within(dialog).getByRole('button', { name: 'Tambahkan ke pesanan' });
  await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(add);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tambahkan item' })).toBeNull());
}

describe('ReferenceOrderAdjustmentDialog — a draft until it is saved', () => {
  afterEach(cleanup);

  it('opening sends nothing to Runtime and shows the persisted Sale', () => {
    const view = renderDialog({ sale: queued() });
    expect(view.onPreview).not.toHaveBeenCalled();
    expect(view.onCommit).not.toHaveBeenCalled();
    expect(screen.getByText('Smoothing Curly')).toBeTruthy();
    expect(save().disabled).toBe(true);
    expect(cancel().disabled).toBe(false);
  });

  it('keeps add, quantity, removal and replacement in the draft, never saving or touching the queued Sale', async () => {
    const view = renderDialog({ sale: queued() });
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    await waitFor(() =>
      expect(view.draft()).toEqual([
        { kind: 'QUANTITY', lineId: 'source-line', quantity: '2.0000' },
      ]),
    );
    await addThroughDialog('shampoo', /Shampoo Premium/);
    await waitFor(() => expect(view.draft()).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: /Hapus Smoothing Curly/ }));
    await waitFor(() =>
      expect(view.draft()).toContainEqual({ kind: 'REMOVE', lineId: 'source-line' }),
    );
    // Removal supersedes the earlier quantity change of the same line.
    expect(
      view.draft().filter((operation: OrderAdjustmentOperation) => operation.kind !== 'ADD'),
    ).toEqual([{ kind: 'REMOVE', lineId: 'source-line' }]);
    expect(view.onCommit).not.toHaveBeenCalled();
    expect(view.onCommitted).not.toHaveBeenCalled();
    expect(view.persisted.lines[0]!.quantity).toBe('1.0000');
  });

  it('Batal discards the draft with no Runtime command, and reopening starts from the persisted Sale', async () => {
    const view = renderDialog({ sale: queued() });
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    await impact();
    fireEvent.click(cancel());
    expect(view.onClose).toHaveBeenCalledTimes(1);
    expect(view.onCommit).not.toHaveBeenCalled();
    expect(view.onCommitted).not.toHaveBeenCalled();

    const previews = view.onPreview.mock.calls.length;
    view.reopen();
    expect(screen.queryByLabelText('Dampak penyesuaian')).toBeNull();
    expect(save().disabled).toBe(true);
    expect(view.onPreview).toHaveBeenCalledTimes(previews);
  });

  it.each([
    { via: 'Batal', exit: () => fireEvent.click(cancel()) },
    {
      via: 'the X',
      exit: () => fireEvent.click(screen.getByRole('button', { name: 'Tutup dialog' })),
    },
    { via: 'Escape', exit: () => fireEvent.keyDown(document, { key: 'Escape' }) },
  ])(
    'closing a changed draft with $via takes the one discard exit and saves nothing',
    async ({ exit }) => {
      const view = renderDialog({ sale: queued() });
      fireEvent.click(screen.getByRole('button', { name: /Hapus Smoothing Curly/ }));
      await impact();
      exit();
      expect(view.onClose).toHaveBeenCalledTimes(1);
      expect(view.onCommit).not.toHaveBeenCalled();
      expect(view.onCommitted).not.toHaveBeenCalled();
    },
  );

  it('shows the Runtime impact of the draft before saving', async () => {
    renderDialog({ sale: queued() });
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    const shown = await impact();
    expect(shown.textContent).toContain('Total sebelumnya');
    expect(shown.textContent).toContain('100.000');
    expect(shown.textContent).toContain('Total setelah penyesuaian');
    expect(shown.textContent).toContain('200.000');
    expect(shown.textContent).toContain('Sisa tagihan');
  });

  it('never shows an older preview over a newer draft, and keeps the last one while recalculating', async () => {
    const view = renderDialog({ sale: queued() });
    const pending: Array<() => void> = [];
    view.onPreview.mockImplementation(
      (...[, input]: Parameters<PreviewFn>) =>
        new Promise((resolve) =>
          pending.push(() => resolve(fakeRuntimePreview(view.persisted, input, {}))),
        ),
    );
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    await waitFor(() => expect(pending).toHaveLength(2));
    // The newer draft answers first; the late answer for the older draft must not replace it.
    await act(async () => pending[1]!());
    expect((await impact()).textContent).toContain('300.000');
    await act(async () => pending[0]!());
    expect((await impact()).textContent).toContain('300.000');
    expect(save().disabled).toBe(false);
  });

  it('keeps the draft and blocks saving when the preview fails, and recalculates on request', async () => {
    const view = renderDialog({ sale: queued() });
    view.onPreview.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    expect(await screen.findByText('Penyesuaian tidak dapat dihitung. Coba lagi.')).toBeTruthy();
    expect(save().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Hitung ulang' }));
    await impact();
    await waitFor(() => expect(save().disabled).toBe(false));
    expect(view.draft()).toEqual([{ kind: 'QUANTITY', lineId: 'source-line', quantity: '2.0000' }]);
  });

  it('saves the whole draft once, acknowledging the reviewed consequence, and hands over only Runtime’s Sale', async () => {
    const view = renderDialog({ sale: queued() });
    let finish: (value: OrderAdjustmentResult) => void = () => undefined;
    view.onCommit.mockImplementationOnce(
      () => new Promise<OrderAdjustmentResult>((resolve) => (finish = resolve)),
    );
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    await impact();
    await waitFor(() => expect(save().disabled).toBe(false));
    fireEvent.click(save());
    fireEvent.click(save());
    expect(view.onCommit).toHaveBeenCalledTimes(1);
    const [saleId, input, key] = view.onCommit.mock.calls[0]!;
    expect(saleId).toBe('sale-1');
    expect(input).toEqual({
      expectedVersion: 3,
      operations: [{ kind: 'QUANTITY', lineId: 'source-line', quantity: '2.0000' }],
      acknowledgement: {
        previewVersion: 3,
        consequence: 'ADDITIONAL_PAYMENT_REQUIRED',
        amount: '100000.0000',
        proposedTotalAmount: '200000.0000',
      },
    });
    expect(key).toMatch(/^cashier-order-adjustment-/);
    // The queue changes only once Runtime has answered.
    expect(view.onCommitted).not.toHaveBeenCalled();
    const result = {
      adjustmentId: 'adjustment-1',
      sale: { ...view.persisted, version: 4, totalAmount: '200000.0000' },
      lines: [],
      settlement: fakeRuntimePreview(view.persisted, input, {}).settlement,
    } as OrderAdjustmentResult;
    await act(async () => finish(result));
    expect(view.onCommitted).toHaveBeenCalledWith(result);
    expect(await screen.findByText('Penyesuaian berhasil disimpan')).toBeTruthy();
  });

  it('keeps the dialog, the draft and the queued Sale when saving fails, and retries the same request', async () => {
    const { ApiError } = await import('@digvation/pos-api');
    const view = renderDialog({ sale: queued() });
    view.onCommit.mockRejectedValueOnce(new ApiError(409, 'SALE_PAYMENT_PENDING', 'pending'));
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    await impact();
    await waitFor(() => expect(save().disabled).toBe(false));
    fireEvent.click(save());
    expect(
      await screen.findByText('Ada pembayaran yang masih menunggu konfirmasi.', { exact: false }),
    ).toBeTruthy();
    expect(view.onCommitted).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Sesuaikan pesanan' })).toBeTruthy();
    expect(view.draft()).toHaveLength(1);

    await waitFor(() => expect(save().disabled).toBe(false));
    fireEvent.click(save());
    await waitFor(() => expect(view.onCommitted).toHaveBeenCalledTimes(1));
    expect(view.onCommit.mock.calls[1]![2]).toBe(view.onCommit.mock.calls[0]![2]);
  });

  it('recovers from a Sale changed elsewhere by reloading it and pricing the same draft again', async () => {
    const { ApiError } = await import('@digvation/pos-api');
    const view = renderDialog({ sale: queued() });
    view.onCommit.mockRejectedValueOnce(new ApiError(409, 'SALE_VERSION_CONFLICT', 'stale'));
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    await impact();
    await waitFor(() => expect(save().disabled).toBe(false));
    fireEvent.click(save());
    fireEvent.click(await screen.findByRole('button', { name: 'Muat ulang transaksi' }));
    await waitFor(() => expect(view.onReload).toHaveBeenCalledWith('sale-1'));
    await waitFor(() =>
      expect(view.onPreview.mock.calls.at(-1)![1]).toEqual({
        expectedVersion: 4,
        operations: [{ kind: 'QUANTITY', lineId: 'source-line', quantity: '2.0000' }],
      }),
    );
    expect(view.onCommitted).not.toHaveBeenCalled();
  });

  it('shows an exact settlement as paid in full', async () => {
    const half = {
      ...queued(),
      payments: [{ ...queued().payments[0]!, appliedAmount: '50000.0000' }],
      lines: [{ ...queued().lines[0]!, quantity: '2.0000', effectiveUnitPrice: '50000.0000' }],
    } as Sale;
    renderDialog({ sale: half });
    fireEvent.click(screen.getByRole('button', { name: /Kurangi jumlah Smoothing Curly/ }));
    expect((await impact()).textContent).toContain('Lunas');
  });

  /** The reviewed Sale: 410.700 + 205.350 = 616.050, paid as given, oldest payment first. */
  const paidSale = (payments: Array<[method: string, applied: number, account?: string]>) =>
    ({
      ...queued(),
      totalAmount: '616050.0000',
      payments: payments.map(([method, applied, account], index) => ({
        id: `payment-${index + 1}`,
        status: 'SUCCEEDED',
        method,
        appliedAmount: amount(applied),
        tenderedAmount: null,
        changeAmount: null,
        financeFinancialAccountNameSnapshot: account ?? null,
      })),
      lines: [
        {
          ...queued().lines[0]!,
          effectiveUnitPrice: '410700.0000',
          grossAmount: '410700.0000',
        },
        {
          ...queued().lines[0]!,
          id: 'extra-line',
          catalogItemId: 'single',
          itemNameSnapshot: 'QA Item Tunggal',
          effectiveUnitPrice: '205350.0000',
          grossAmount: '205350.0000',
        },
      ],
    }) as unknown as Sale;
  const removeExtra = () =>
    fireEvent.click(screen.getByRole('button', { name: /Hapus QA Item Tunggal/ }));
  const permissionAlert = () =>
    screen.queryByText('Akun Anda tidak memiliki izin untuk melakukan pengembalian dana.');

  it('shows the refund as already paid minus the proposed total, with the original payments', async () => {
    renderDialog({
      sale: paidSale([
        ['BANK_TRANSFER', 205350, 'BCA'],
        ['QRIS', 410700, 'QRIS BRI'],
      ]),
    });
    removeExtra();
    const shown = (await impact()).textContent ?? '';
    expect(shown).toMatch(/Total sebelumnya.*616\.050/);
    expect(shown).toMatch(/Total setelah penyesuaian.*410\.700/);
    expect(shown).toMatch(/Sudah dibayar.*616\.050/);
    expect(shown).toMatch(/Dana dikembalikan.*205\.350/);
    // Newest first: the QRIS payment's capacity covers the refund; shown for information only.
    expect(shown).toMatch(/Pembayaran awal: QRIS · QRIS BRI.*205\.350/);
  });

  it('returns a QRIS payment manually by bank transfer from the chosen account', async () => {
    const view = renderDialog({ sale: paidSale([['QRIS', 616050, 'QRIS BRI']]) });
    removeExtra();
    await impact();
    const picker = screen.getByRole('region', { name: 'Pengembalian dana' });
    // Only manual methods are offered; QRIS is never a way to return money here.
    expect(within(picker).getByRole('button', { name: 'Tunai' })).toBeTruthy();
    expect(within(picker).queryByRole('button', { name: 'QRIS' })).toBeNull();
    fireEvent.click(within(picker).getByRole('button', { name: 'Transfer bank' }));
    fireEvent.change(within(picker).getByLabelText('Referensi (opsional)'), {
      target: { value: 'TRF-0001' },
    });
    fireEvent.change(within(picker).getByLabelText('Catatan (opsional)'), {
      target: { value: 'Salah item' },
    });
    await waitFor(() => expect(save().disabled).toBe(false));
    fireEvent.click(save());
    await waitFor(() => expect(view.onCommitted).toHaveBeenCalledTimes(1));
    expect(view.onCommit.mock.calls[0]![1]).toMatchObject({
      acknowledgement: { consequence: 'REFUND_REQUIRED', amount: '205350.0000' },
      refundDisbursement: {
        method: 'BANK_TRANSFER',
        paymentRouteId: 'route-bca',
        externalReference: 'TRF-0001',
        note: 'Salah item',
      },
    });
  });

  it('starts from cash and sends only the chosen account', async () => {
    const view = renderDialog({ sale: paidSale([['CASH', 616050]]) });
    removeExtra();
    await impact();
    await waitFor(() => expect(save().disabled).toBe(false));
    fireEvent.click(save());
    await waitFor(() => expect(view.onCommitted).toHaveBeenCalledTimes(1));
    expect(view.onCommit.mock.calls[0]![1].refundDisbursement).toEqual({
      method: 'CASH',
      paymentRouteId: 'route-cash',
    });
  });

  it('cannot save a refund without an active cash or bank account', async () => {
    const view = renderDialog({
      sale: paidSale([['QRIS', 616050]]),
      paymentRoutes: [route('route-qris', 'QRIS', 'QRIS BRI')],
    });
    removeExtra();
    await impact();
    expect(
      screen.getByText(
        'Belum ada akun tunai atau transfer bank yang aktif untuk pengembalian dana di lokasi ini.',
      ),
    ).toBeTruthy();
    expect(save().disabled).toBe(true);
    expect(view.onCommit).not.toHaveBeenCalled();
  });

  it('never claims a provider refund happened', async () => {
    renderDialog({ sale: paidSale([['QRIS', 616050, 'QRIS BRI']]) });
    removeExtra();
    await impact();
    expect(screen.getByText(/dicatat manual/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/otomatis|penyedia pembayaran|dikirim ke QRIS/i);
  });

  it('asks for a supervisor when the account may not refund', async () => {
    const view = renderDialog({
      sale: paidSale([['CASH', 616050]]),
      refundPermissionGranted: false,
    });
    removeExtra();
    await impact();
    await expect(view.onPreview.mock.results.at(-1)?.value).resolves.toMatchObject({
      commitAllowed: false,
      settlement: { refundPermissionRequired: true, refundPermissionGranted: false },
    });
    expect(screen.getByText(/^Pengembalian dana Rp.205\.350 diperlukan\.$/)).toBeTruthy();
    expect(permissionAlert()).toBeTruthy();
    expect(save().disabled).toBe(true);
  });

  it('ignores the refund permission when nothing is returned', async () => {
    const view = renderDialog({ sale: queued(), refundPermissionGranted: false });
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    await impact();
    await expect(view.onPreview.mock.results.at(-1)?.value).resolves.toMatchObject({
      commitAllowed: true,
      settlement: { refundRequired: false, refundPermissionRequired: false },
    });
    expect(permissionAlert()).toBeNull();
    expect(screen.queryByRole('region', { name: 'Pengembalian dana' })).toBeNull();
    await waitFor(() => expect(save().disabled).toBe(false));
  });

  it('shows why Runtime refuses a change of the draft, never a raw code', async () => {
    renderDialog({
      sale: queued(),
      issues: [{ operationIndex: 0, code: 'CATALOG_ITEM_NOT_FOUND', message: 'gone' }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    expect(await screen.findByText('Item pengganti tidak lagi tersedia.')).toBeTruthy();
    expect(screen.queryByText(/CATALOG_ITEM_NOT_FOUND/)).toBeNull();
    expect(save().disabled).toBe(true);
  });

  it('no longer reaches the open-Sale compensation endpoint', () => {
    expect('compensateOpenSalePayment' in HttpCashierTransactionAdapter.prototype).toBe(false);
  });
});

describe('ReferenceOrderAdjustmentDialog — removing every item', () => {
  afterEach(cleanup);

  const removeAll = () =>
    fireEvent.click(screen.getByRole('button', { name: /Hapus Smoothing Curly/ }));

  it('turns an emptied draft into a cancellation, never a paid Sale of Rp 0', async () => {
    const view = renderDialog({ sale: { ...queued(), payments: [] } as Sale });
    removeAll();
    const shown = await impact();
    expect(shown.textContent).toContain('Semua item akan dihapus');
    expect(shown.textContent).toContain(
      'Transaksi ini tidak lagi memiliki item. Menyimpan perubahan akan membatalkan transaksi.',
    );
    expect(shown.textContent).not.toContain('Total setelah penyesuaian');
    expect(shown.textContent).not.toContain('Lunas');
    expect(screen.queryByRole('button', { name: 'Simpan penyesuaian' })).toBeNull();
    const confirm = screen.getByRole('button', { name: 'Batalkan transaksi' }) as HTMLButtonElement;
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(view.onCommitted).toHaveBeenCalledTimes(1));
    expect(view.onCommit.mock.calls[0]![1]).toMatchObject({
      acknowledgement: { consequence: 'VOID_REQUIRED' },
    });
    expect(view.onCommit.mock.calls[0]![1].refundDisbursement).toBeUndefined();
    expect(await screen.findByText('Transaksi dibatalkan')).toBeTruthy();
  });

  it('cancels a paid transaction only with a refund disbursement', async () => {
    const view = renderDialog({ sale: queued() });
    removeAll();
    const shown = await impact();
    expect(shown.textContent).toMatch(/Dana dikembalikan.*100\.000/);
    const picker = screen.getByRole('region', { name: 'Pengembalian dana' });
    fireEvent.click(within(picker).getByRole('button', { name: 'Transfer bank' }));
    const confirm = screen.getByRole('button', { name: 'Batalkan transaksi' }) as HTMLButtonElement;
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(view.onCommitted).toHaveBeenCalledTimes(1));
    expect(view.onCommit.mock.calls[0]![1]).toMatchObject({
      acknowledgement: { consequence: 'VOID_REQUIRED', amount: '100000.0000' },
      refundDisbursement: { method: 'BANK_TRANSFER', paymentRouteId: 'route-bca' },
    });
  });

  it('keeps everything when the emptied draft is discarded with Batal', async () => {
    const view = renderDialog({ sale: queued() });
    removeAll();
    await impact();
    fireEvent.click(cancel());
    expect(view.onClose).toHaveBeenCalledTimes(1);
    expect(view.onCommit).not.toHaveBeenCalled();
  });

  it('needs the void permission to cancel through an adjustment', async () => {
    renderDialog({ sale: queued(), voidPermissionGranted: false });
    removeAll();
    await impact();
    expect(
      screen.getByText('Membatalkan transaksi ini memerlukan izin pembatalan transaksi.'),
    ).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Batalkan transaksi' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

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
    'configures $kind in the shared configuration below, then adds it to the draft on confirm',
    async ({ query, option, id }) => {
      const view = renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
      fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
      await choose('Cari produk atau layanan', query, option);
      const quantity = await within(addDialog()).findByRole('textbox', { name: 'Jumlah' });
      // An item with variants is configured like at the counter: its variant is chosen first.
      const variants = within(addDialog()).queryByRole('region', { name: 'Pilih varian' });
      if (variants) fireEvent.click(within(variants).getAllByRole('button')[0]!);
      expect(view.loadConfiguratorState).toHaveBeenCalledWith(expect.objectContaining({ id }));
      // Choosing only selects what to configure; nothing is proposed yet.
      expect(view.onPreview).not.toHaveBeenCalled();
      fireEvent.change(quantity, { target: { value: '2' } });
      // No correction reason and no impact step: nothing is being replaced.
      expect(screen.queryByLabelText('Alasan koreksi')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Lihat dampak' })).toBeNull();
      const add = within(addDialog()).getByRole('button', { name: 'Tambahkan ke pesanan' });
      await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(add);
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Tambahkan item' })).toBeNull(),
      );
      await waitFor(() =>
        expect(view.draft()).toEqual([
          expect.objectContaining({
            kind: 'ADD',
            lines: [expect.objectContaining({ catalogItemId: id, quantity: '2' })],
          }),
        ]),
      );
      expect(view.onCommit).not.toHaveBeenCalled();
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

  it('forgets an item added and removed again before saving', async () => {
    const view = renderDialog({ sale: queued() });
    await addThroughDialog('qa item', /QA Item Tunggal/);
    fireEvent.click(await screen.findByRole('button', { name: 'Hapus QA Item Tunggal' }));
    await waitFor(() => expect(screen.queryByText('QA Item Tunggal')).toBeNull());
    expect(save().disabled).toBe(true);
    expect(view.onCommit).not.toHaveBeenCalled();
  });

  it('cannot add anything without the adjustment permission', () => {
    const view = renderDialog({ sale: sale('OPEN', 'IN_PROGRESS'), canAdjust: false });
    const add = screen.getByRole('button', { name: 'Tambahkan item' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.click(add);
    expect(screen.queryByRole('dialog', { name: 'Tambahkan item' })).toBeNull();
    expect(view.onPreview).not.toHaveBeenCalled();
  });
});

describe('ReferenceOrderAdjustmentDialog — ordinary edit before work starts', () => {
  afterEach(cleanup);

  it('keeps quantity, removal and an item edit for a not-yet-started line, without correction', async () => {
    const view = renderDialog({ sale: queued() });
    fireEvent.click(screen.getByRole('button', { name: /Tambah jumlah Smoothing Curly/ }));
    await waitFor(() =>
      expect(view.draft()).toEqual([
        { kind: 'QUANTITY', lineId: 'source-line', quantity: '2.0000' },
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: /Hapus Smoothing Curly/ }));
    await waitFor(() => expect(view.draft()).toEqual([{ kind: 'REMOVE', lineId: 'source-line' }]));
    expect(screen.queryByRole('button', { name: /Koreksi item/ })).toBeNull();
  });

  it('edits the line in the shared item configuration into the draft, with no reason or impact step', async () => {
    const view = renderDialog({ sale: queued() });
    fireEvent.click(screen.getByRole('button', { name: 'Ubah item Smoothing Curly' }));
    const quantityInput = await screen.findByRole('textbox', { name: 'Jumlah' });
    fireEvent.change(quantityInput, { target: { value: '2' } });
    expect(screen.queryByLabelText('Alasan koreksi')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lihat dampak' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Simpan perubahan/ }));
    await waitFor(() =>
      expect(view.draft()).toEqual([
        {
          kind: 'REPLACE',
          lineId: 'source-line',
          lines: [{ catalogItemId: 'source-item', quantity: '2' }],
        },
      ]),
    );
    expect(view.onCommit).not.toHaveBeenCalled();
  });

  it('turns every editing control off when the session may not adjust this Sale', () => {
    renderDialog({ sale: queued(), canAdjust: false });
    for (const name of [
      /Tambah jumlah Smoothing Curly/,
      /Hapus Smoothing Curly/,
      /Ubah item Smoothing Curly/,
    ])
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    // Closing stays possible.
    expect(cancel().disabled).toBe(false);
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
    expect(view.replaceOf()).toEqual({
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
    expect(view.replaceOf()).toEqual({
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
    expect(view.replaceOf()).toEqual({
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
    expect(view.replaceOf()).toEqual({
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
    expect(view.replaceOf()).toEqual({
      lines: [{ catalogItemId: 'color', catalogVariantId: 'red', quantity: '1' }],
      reason: 'Ganti tambahan',
    });
  });

  it('shows a lower corrected total as the Runtime refund, not as a failure', async () => {
    renderDialog({
      impact: previewOf({
        correctedTotalAmount: '60000.0000',
        netSuccessfulPaidAmount: '100000.0000',
      }),
    });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    const shown = await screen.findByLabelText('Dampak koreksi');
    expect(shown.textContent).toContain('Dikembalikan ke pelanggan');
    expect(shown.textContent).toContain('40.000');
    expect(shown.textContent).not.toContain('Sisa pembayaran');
  });

  it('names a missing reason from Runtime instead of a generic failure', async () => {
    const { ApiError } = await import('@digvation/pos-api');
    renderDialog({ previewError: new ApiError(409, 'SALE_CORRECTION_REASON_REQUIRED', 'reason') });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(await screen.findByText('Isi alasan koreksi.')).toBeTruthy();
  });

  it('names a correction Runtime refuses in the draft preview', async () => {
    renderDialog({
      issues: [{ operationIndex: 0, code: 'SALE_LINE_NOT_MUTABLE', message: 'locked' }],
    });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(
      await screen.findByText(
        'Item ini tidak dapat dikoreksi: pekerjaannya sudah selesai, pelaksana sudah ditetapkan sebelum pekerjaan dimulai, atau ada harga manual atau diskon.',
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Dampak koreksi')).toBeNull();
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

  it('previews the remaining balance from Runtime, never a predicted overpayment', async () => {
    renderDialog({
      impact: previewOf({
        correctedTotalAmount: '80000.0000',
        netSuccessfulPaidAmount: '55000.0000',
      }),
    });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(await screen.findByText('Sisa pembayaran')).toBeTruthy();
    expect(screen.queryByText('Kelebihan pembayaran')).toBeNull();
  });

  it('shows the Runtime-calculated replacement lines and totals in the impact, not a Web calculation', async () => {
    renderDialog({
      impact: previewOf({
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
        ],
      }),
    });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    const shown = await screen.findByLabelText('Dampak koreksi');
    expect(shown.textContent).toContain('Addition A');
    expect(shown.textContent).toContain('425.000');
    expect(shown.textContent).not.toContain('212.500');
  });

  it('offers the shared per-unit configuration in a correction', async () => {
    renderDialog();
    await openCorrection();
    fireEvent.change(screen.getByRole('textbox', { name: 'Jumlah' }), { target: { value: '2' } });
    expect(screen.getByRole('list', { name: 'Unit' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /Gunakan item tambahan/ })).toBeTruthy();
  });

  it('confirms the correction into the draft only, and saves it with its reason on Simpan penyesuaian', async () => {
    const view = renderDialog();
    await previewAndConfirm();
    await waitFor(() => expect(screen.queryByText('Item saat ini')).toBeNull());
    expect(view.onCommit).not.toHaveBeenCalled();
    expect(view.onCommitted).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(view.draft()).toEqual([
        expect.objectContaining({
          kind: 'REPLACE',
          lineId: 'source-line',
          reason: 'Salah pilih layanan',
        }),
      ]),
    );
    await impact();
    await waitFor(() => expect(save().disabled).toBe(false));
    fireEvent.click(save());
    await waitFor(() => expect(view.onCommitted).toHaveBeenCalledTimes(1));
    expect(view.onCommit.mock.calls[0]![1].operations).toEqual([
      expect.objectContaining({ kind: 'REPLACE', reason: 'Salah pilih layanan' }),
    ]);
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

  it('offers "Dijual oleh" for a Product added to an IN_PROGRESS Sale and proposes the chosen seller', async () => {
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
    await waitFor(() =>
      expect(view.draft()).toEqual([
        expect.objectContaining({
          kind: 'ADD',
          lines: [expect.objectContaining({ soldByEmployeeId: 'emp-andini' })],
        }),
      ]),
    );
  });

  it('never shows the Product seller for a Service', async () => {
    renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
    await choose('Cari produk atau layanan', 'hair', /Hair Color/);
    await screen.findByRole('textbox', { name: 'Jumlah' });
    expect(field()).toBeNull();
  });

  it('lets a Product added in the draft be fixed directly, and shows its seller', async () => {
    const view = renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan item' }));
    await choose('Cari produk atau layanan', 'qa item', /QA Item Tunggal/);
    await screen.findByRole('textbox', { name: 'Jumlah' });
    fireEvent.click(field()!);
    fireEvent.click(await screen.findByRole('option', { name: 'Andini' }));
    const add = screen.getByRole('button', { name: 'Tambahkan ke pesanan' });
    await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(add);
    expect(await screen.findByText('Dijual oleh Andini')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tambah jumlah QA Item Tunggal' }));
    await waitFor(() =>
      expect(view.draft()).toEqual([
        expect.objectContaining({
          kind: 'ADD',
          lines: [expect.objectContaining({ catalogItemId: 'single', quantity: '2.0000' })],
        }),
      ]),
    );
    // Not a correction: no Koreksi item for the new line.
    expect(screen.queryByRole('button', { name: 'Koreksi item QA Item Tunggal' })).toBeNull();
    // The historical in-progress line still goes through Koreksi item only.
    expect(screen.getByRole('button', { name: 'Koreksi item Smoothing Curly' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hapus Smoothing Curly' })).toBeNull();
  });

  it('decreases the quantity of a Product added in the draft, never below one', async () => {
    const view = renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
    await addThroughDialog('qa item', /QA Item Tunggal/, '3');
    fireEvent.click(await screen.findByRole('button', { name: 'Kurangi jumlah QA Item Tunggal' }));
    await waitFor(() =>
      expect(view.draft()).toEqual([
        expect.objectContaining({
          lines: [expect.objectContaining({ quantity: '2.0000' })],
        }),
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Kurangi jumlah QA Item Tunggal' }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Kurangi jumlah QA Item Tunggal',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true),
    );
  });

  it('changes the seller of a Product added in the draft through the ordinary item edit', async () => {
    const view = renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
    await addThroughDialog('qa item', /QA Item Tunggal/);
    fireEvent.click(await screen.findByRole('button', { name: 'Ubah item QA Item Tunggal' }));
    await screen.findByRole('textbox', { name: 'Jumlah' });
    fireEvent.click(field()!);
    fireEvent.click(await screen.findByRole('option', { name: 'Pak Heru' }));
    fireEvent.click(screen.getByRole('button', { name: /^Simpan perubahan/ }));
    await waitFor(() =>
      expect(view.draft()).toEqual([
        expect.objectContaining({
          kind: 'ADD',
          lines: [{ catalogItemId: 'single', quantity: '1', soldByEmployeeId: 'emp-heru' }],
        }),
      ]),
    );
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

  it('prefills the correction with the addition and its performers, and proposes them', async () => {
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
    expect(view.replaceOf().lines).toEqual([
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
    await openCorrection(
      { query: 'hair', option: /Hair Color/ },
      'Salah layanan',
      'Coloring Service',
    );
    expect(screen.queryByRole('group', { name: 'Dikerjakan oleh' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    await screen.findByLabelText('Dampak koreksi');
    expect(JSON.stringify(view.replaceOf())).not.toContain('performers');
  });
});
