import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CatalogItem, CatalogVariant } from '../cashier-transaction.types';
import { VariantPicker } from './variant-picker';

const item = { id: 'item', name: 'Es Teh' } as CatalogItem;
const variants = [
  { id: 'large', code: 'LRG', name: 'Large', status: 'ACTIVE', catalogItemId: 'item' },
  { id: 'jumbo', code: 'JMB', name: 'Jumbo', status: 'ACTIVE', catalogItemId: 'item' },
] as CatalogVariant[];
const prices = { large: '15000.0000', jumbo: '20000.0000' };

afterEach(cleanup);

describe('VariantPicker', () => {
  it('offers only real variants when the item requires one', () => {
    render(
      <VariantPicker
        item={item}
        variants={variants}
        pricesByVariantId={prices}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText('Tanpa varian')).toBeNull();
    expect(screen.getByText('Pilih varian')).toBeTruthy();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(2);
  });

  it('offers the item itself as a separate option and adds it without a variant', async () => {
    const onSelect = vi.fn();
    render(
      <VariantPicker
        item={item}
        variants={variants}
        itemOption={{ price: '10000.0000' }}
        pricesByVariantId={prices}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Pilih opsi')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText('Tanpa varian')));
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Tambahkan ke keranjang' })),
    );
    expect(onSelect).toHaveBeenCalledWith(null);

    await act(async () => fireEvent.click(screen.getByText('Jumbo')));
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Tambahkan ke keranjang' })),
    );
    expect(onSelect).toHaveBeenLastCalledWith('jumbo');
  });
});
