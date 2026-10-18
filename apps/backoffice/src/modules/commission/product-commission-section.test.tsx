import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProductCommissionApi, ProductCommissionRule } from './product-commission-api';
import { ProductCommissionSection } from './product-commission-section';

afterEach(cleanup);

const rule = (overrides: Partial<ProductCommissionRule> = {}): ProductCommissionRule => ({
  catalogItemId: 'shampoo',
  type: 'FIXED_PER_UNIT',
  commissionPerUnit: '5000.0000',
  currency: 'IDR',
  itemCode: 'SHAMPOO',
  itemName: 'Shampoo Premium',
  version: 1,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const catalog = [
  { id: 'shampoo', code: 'SHAMPOO', name: 'Shampoo Premium', type: 'PRODUCT' },
  { id: 'serum', code: 'SERUM', name: 'Hair Serum', type: 'PRODUCT' },
  { id: 'cut', code: 'CUT', name: 'Hair Cut', type: 'SERVICE' },
];

function renderSection(
  options: { rules?: ProductCommissionRule[]; canConfigure?: boolean; total?: number } = {},
) {
  const rules = options.rules ?? [rule()];
  const api = {
    listRules: vi.fn().mockResolvedValue({
      items: rules,
      total: options.total ?? rules.length,
      limit: 20,
      offset: 0,
    }),
    setRule: vi.fn().mockResolvedValue(rule()),
    removeRule: vi.fn().mockResolvedValue(rule()),
  };
  const loadProducts = vi.fn().mockResolvedValue({ items: catalog });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DToastProvider>
        <ProductCommissionSection
          api={api as unknown as ProductCommissionApi}
          loadProducts={loadProducts}
          canConfigure={options.canConfigure ?? true}
        />
      </DToastProvider>
    </QueryClientProvider>,
  );
  return { api, loadProducts };
}

function openProducts(dialog: ReturnType<typeof within>) {
  const input = dialog.getByRole('combobox', { name: 'Produk komisi' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Ha' } });
}

describe('Product commission configuration', () => {
  it('lists configured Products with the exact per-item amount and no enabled toggle', async () => {
    renderSection({
      rules: [
        rule(),
        rule({ catalogItemId: 'serum', itemName: 'Hair Serum', commissionPerUnit: '7500.0000' }),
      ],
    });
    expect(await screen.findAllByText('Shampoo Premium')).toBeTruthy();
    expect(screen.getAllByText('Rp5.000 / item').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rp7.500 / item').length).toBeGreaterThan(0);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('requests one bounded page of rules', async () => {
    const { api } = renderSection({ total: 45 });
    await screen.findAllByText('Shampoo Premium');
    expect(api.listRules).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  it('hides configuration actions without commission:configure', async () => {
    renderSection({ canConfigure: false });
    await screen.findAllByText('Shampoo Premium');
    expect(screen.queryByRole('button', { name: /Tambah Produk/ })).toBeNull();
  });

  it('adds a Product with a valid amount and offers no Service or duplicate', async () => {
    const { api } = renderSection();
    await screen.findAllByText('Shampoo Premium');
    fireEvent.click(screen.getAllByRole('button', { name: /Tambah Produk/ })[0]!);
    const dialog = within(await screen.findByRole('dialog'));

    openProducts(dialog);
    expect(await screen.findByRole('option', { name: /Hair Serum/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Hair Cut/ })).toBeNull();
    expect(screen.queryByRole('option', { name: /Shampoo Premium/ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /Hair Serum/ }));

    fireEvent.change(dialog.getByLabelText(/Komisi per item/), { target: { value: '7500' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));
    await waitFor(() =>
      expect(api.setRule).toHaveBeenCalledWith('serum', {
        expectedVersion: 0,
        commissionPerUnit: '7500',
      }),
    );
  });

  it.each(['0', 'abc'])(
    'does not save the invalid amount %p (negative is covered by the model)',
    async (value) => {
      const { api } = renderSection();
      await screen.findAllByText('Shampoo Premium');
      fireEvent.click(screen.getAllByRole('button', { name: /Tambah Produk/ })[0]!);
      const dialog = within(await screen.findByRole('dialog'));
      openProducts(dialog);
      fireEvent.click(await screen.findByRole('option', { name: /Hair Serum/ }));
      fireEvent.change(dialog.getByLabelText(/Komisi per item/), { target: { value } });
      fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));
      expect(api.setRule).not.toHaveBeenCalled();
    },
  );
});
