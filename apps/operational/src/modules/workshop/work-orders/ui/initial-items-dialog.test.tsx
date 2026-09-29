import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../app/localization/operational-localization', () => ({
  useOperationalLocalization: () => ({
    locale: 'id-ID',
    copy: (value: string) => value,
    label: (value: string) => value,
  }),
}));

import type { PickerItem } from '../api/workshop-lines-api';
import { InitialItemsDialog } from './initial-items-dialog';

const price = (amount: string) => ({ amount, currency: 'IDR' });

const CATALOG: PickerItem[] = [
  {
    id: 'svc-oil',
    code: 'GANTI-OLI',
    name: 'Ganti Oli',
    type: 'SERVICE',
    lifecycle: 'ACTIVE',
    resolvedPrice: price('50000'),
    variants: [],
  },
  {
    id: 'svc-big',
    code: 'SERVIS-BESAR',
    name: 'Servis Besar',
    type: 'SERVICE',
    lifecycle: 'ACTIVE',
    resolvedPrice: price('120000'),
    variants: [],
    fixedComponents: [
      { componentItemId: 'p-filter', itemName: 'Filter Oli', variantName: null, quantity: '2.0000' },
      { componentItemId: 'p-baut', itemName: 'Baut Kuras', variantName: null, quantity: '1.0000' },
    ],
  },
  {
    id: 'prt-tire',
    code: 'BAN',
    name: 'Ban Luar',
    type: 'PRODUCT',
    lifecycle: 'ACTIVE',
    variantSelectionMode: 'REQUIRED',
    resolvedPrice: null,
    variants: [
      { id: 'v-80', code: 'B80', name: 'Ukuran 80', status: 'ACTIVE', resolvedPrice: price('200000') },
      { id: 'v-90', code: 'B90', name: 'Ukuran 90', status: 'ACTIVE', resolvedPrice: price('250000') },
      { id: 'v-old', code: 'BOLD', name: 'Ukuran lama', status: 'INACTIVE', resolvedPrice: price('1') },
    ],
  },
  {
    id: 'prt-oil',
    code: 'OLI-1L',
    name: 'Oli Mesin 1L',
    type: 'PRODUCT',
    lifecycle: 'ACTIVE',
    resolvedPrice: price('75000'),
    variants: [],
  },
  {
    id: 'svc-needs',
    code: 'SERVIS',
    name: 'Servis Rutin',
    type: 'SERVICE',
    lifecycle: 'ACTIVE',
    requireAdditionalItemAtSale: true,
    resolvedPrice: price('120000'),
    variants: [],
  },
  {
    id: 'prt-hidden',
    code: 'SEKRUP',
    name: 'Sekrup Komponen',
    type: 'PRODUCT',
    lifecycle: 'ACTIVE',
    productUsage: 'COMPONENT_ONLY',
    resolvedPrice: price('100'),
    variants: [],
  },
];

function renderDialog(overrides: Partial<Parameters<typeof InitialItemsDialog>[0]> = {}) {
  const props = {
    open: true,
    items: CATALOG,
    loading: false,
    failed: false,
    candidates: [],
    candidatesLoading: false,
    candidatesFailed: false,
    pending: false,
    onWantCandidates: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<InitialItemsDialog {...props} />);
  return props;
}

const saveButton = () => screen.getByRole('button', { name: 'Save items' }) as HTMLButtonElement;
const add = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Add ${name}` }));
const configure = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
const selected = () => screen.getByRole('region', { name: 'Selected items' });

describe('InitialItemsDialog', () => {
  afterEach(cleanup);

  it('separates browsing from the local draft and hides component-only Products', () => {
    renderDialog();
    expect(screen.getByRole('region', { name: 'Search and add items' })).toBeTruthy();
    expect(within(selected()).getByText('No items selected.')).toBeTruthy();
    expect(screen.queryByText('Sekrup Komponen')).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });

  it('shows type and code as secondary context and the Catalog price on the right', () => {
    renderDialog();
    expect(screen.getByText('Spare part · OLI-1L')).toBeTruthy();
    expect(screen.getByText('Service · GANTI-OLI')).toBeTruthy();
    expect(screen.getByText(/75\.000/)).toBeTruthy();
    // Variant-only Product: starts-from price of its active variants only.
    expect(screen.getByText('Starts from')).toBeTruthy();
    expect(screen.getByText(/200\.000/)).toBeTruthy();
  });

  it('uses Plus for an item that can be added at once, including a composed Service', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Add Oli Mesin 1L' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Ganti Oli' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Servis Besar' })).toBeTruthy();
    // Composition is secondary context in the row, never a separate selection.
    expect(screen.getByText('Includes: Filter Oli ×2, Baut Kuras ×1')).toBeTruthy();
    // Items that need a choice have no Plus, only an expandable row.
    expect(screen.queryByRole('button', { name: 'Add Ban Luar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Servis Rutin' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Ban Luar/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('adds a simple Product and a Service in one tap and marks them selected', () => {
    renderDialog();
    add('Oli Mesin 1L');
    add('Servis Besar');
    expect(within(selected()).getByText('Oli Mesin 1L')).toBeTruthy();
    expect(within(selected()).getByText('2 items')).toBeTruthy();
    expect(within(selected()).getByText('Includes: Filter Oli ×2, Baut Kuras ×1')).toBeTruthy();
    // Already in the draft: no second Plus, a selected state instead.
    expect(screen.queryByRole('button', { name: 'Add Oli Mesin 1L' })).toBeNull();
    expect(screen.getAllByRole('img', { name: 'Selected' })).toHaveLength(2);
  });

  it('configures a required Variant before adding and never offers an inactive Variant', () => {
    const { onConfirm } = renderDialog();
    configure('Ban Luar');
    const group = screen.getByRole('radiogroup', { name: 'Choose a variant' });
    expect(within(group).queryByText('Ukuran lama')).toBeNull();
    expect(within(group).queryByText('No variant')).toBeNull();
    const addItem = screen.getByRole('button', { name: /Add item/ }) as HTMLButtonElement;
    expect(addItem.disabled).toBe(true);

    fireEvent.click(within(group).getByRole('radio', { name: /Ukuran 90/ }));
    expect(addItem.disabled).toBe(false);
    fireEvent.click(addItem);

    expect(within(selected()).getByText('Spare part · Ukuran 90')).toBeTruthy();
    fireEvent.click(saveButton());
    expect(onConfirm).toHaveBeenCalledWith([
      { catalogItemId: 'prt-tire', catalogVariantId: 'v-90', quantity: '1' },
    ]);
  });

  it('sets the quantity while configuring and steps it in the draft', () => {
    const { onConfirm } = renderDialog();
    configure('Ban Luar');
    fireEvent.click(screen.getByRole('radio', { name: /Ukuran 80/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity Ban Luar' }));
    fireEvent.click(screen.getByRole('button', { name: /Add item/ }));
    expect((screen.getByLabelText('Quantity Ban Luar') as HTMLInputElement).value).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity Ban Luar' }));
    fireEvent.click(saveButton());
    expect(onConfirm).toHaveBeenCalledWith([
      { catalogItemId: 'prt-tire', catalogVariantId: 'v-80', quantity: '3' },
    ]);
  });

  it('keeps the draft while searching and filtering', () => {
    renderDialog();
    add('Oli Mesin 1L');
    fireEvent.change(screen.getByPlaceholderText('Search services or spare parts'), {
      target: { value: 'ban' },
    });
    expect(screen.queryByText('Ganti Oli')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Service' }));
    expect(screen.getByText('No services or spare parts match your search.')).toBeTruthy();
    expect(within(selected()).getByText('Oli Mesin 1L')).toBeTruthy();
  });

  it('removes a draft row and returns to the compact empty message', () => {
    renderDialog();
    add('Ganti Oli');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ganti Oli' }));
    expect(within(selected()).getByText('No items selected.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Ganti Oli' })).toBeTruthy();
  });

  it('blocks submission for an invalid typed quantity', () => {
    renderDialog();
    add('Oli Mesin 1L');
    fireEvent.change(screen.getByLabelText('Quantity Oli Mesin 1L'), { target: { value: '0' } });
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText('Enter a quantity above zero.')).toBeTruthy();
  });

  it('requires the additional item Catalog demands before the line can be added', () => {
    const { onWantCandidates } = renderDialog();
    configure('Servis Rutin');
    expect(screen.getByText('This service needs one additional item.')).toBeTruthy();
    expect(onWantCandidates).toHaveBeenCalled();
    expect((screen.getByRole('button', { name: /Add item/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(within(selected()).getByText('No items selected.')).toBeTruthy();
  });

  it('shows a retry when the catalog cannot load and a pending save', () => {
    const { onRetry } = renderDialog({ failed: true, items: undefined });
    expect(screen.getByText('Could not load the catalog.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
    cleanup();

    renderDialog({ pending: true });
    add('Oli Mesin 1L');
    expect(saveButton().disabled || saveButton().getAttribute('aria-busy') === 'true').toBe(true);
  });
});
