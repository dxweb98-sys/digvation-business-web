import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  CatalogApi,
  ServiceComposition,
  ServiceCompositionComponent,
  Variant,
} from '../api/catalog-api';
import { CatalogItemFixedComponents } from './catalog-item-fixed-components';

const variant = (id: string, name: string, status: Variant['status'] = 'ACTIVE'): Variant => ({
  id,
  code: id.toUpperCase(),
  name,
  status,
  version: 1,
  catalogItemId: 'svc',
});

const component = (
  overrides: Partial<ServiceCompositionComponent> & { id: string; componentName: string },
): ServiceCompositionComponent => ({
  position: 0,
  componentItemId: overrides.id,
  componentVariantId: null,
  quantity: '1.0000',
  pricingMode: 'INCLUDED_IN_SERVICE_PRICE',
  fixedUnitPrice: null,
  componentCode: overrides.id.toUpperCase(),
  componentUsage: 'COMPONENT_ONLY',
  componentVariantCode: null,
  componentVariantName: null,
  ...overrides,
});

function renderPanel(
  composition: ServiceComposition,
  options: { type?: 'SERVICE' | 'PRODUCT'; variants?: Variant[] } = {},
) {
  const api = {
    getServiceComposition: vi.fn(async () => composition),
  } as unknown as CatalogApi;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CatalogItemFixedComponents
        item={{ id: 'svc', type: options.type ?? 'SERVICE' }}
        api={api}
        variants={options.variants ?? [variant('red', 'Red'), variant('blue', 'Blue')]}
      />
    </QueryClientProvider>,
  );
  return api;
}

const base = { catalogItemId: 'svc', version: 3 };

afterEach(cleanup);

describe('Catalog item detail — fixed components (current configuration)', () => {
  it('explains an empty state instead of omitting the concept', async () => {
    renderPanel({ ...base, default: [], variantOverrides: [] });
    expect(await screen.findByText(/Belum ada komponen tetap/)).toBeTruthy();
  });

  it('lists the Service default composition with Product, Variant and quantity', async () => {
    renderPanel({
      ...base,
      default: [
        component({ id: 'dev', componentName: 'Developer 20 vol', quantity: '1.0000' }),
        component({
          id: 'dye',
          componentName: 'Hair Dye',
          componentVariantName: 'Red',
          quantity: '2.5000',
        }),
      ],
      variantOverrides: [],
    });
    const list = await screen.findByRole('region', { name: 'Komposisi bawaan jasa' });
    expect(within(list).getByText('Developer 20 vol')).toBeTruthy();
    expect(within(list).getByText('× 1')).toBeTruthy();
    expect(within(list).getByText(/Hair Dye/)).toBeTruthy();
    expect(within(list).getByText(/\/ Red/)).toBeTruthy();
    expect(within(list).getByText('× 2.5')).toBeTruthy();
    expect(screen.queryByText(/Komposisi khusus/)).toBeNull();
  });

  it('keeps a Variant recipe distinct from the default and says which variants use the default', async () => {
    renderPanel({
      ...base,
      default: [component({ id: 'dev', componentName: 'Developer 20 vol' })],
      variantOverrides: [
        {
          catalogVariantId: 'red',
          components: [component({ id: 'dev30', componentName: 'Developer 30 vol' })],
        },
        // An empty override means "use the default": never shown as a recipe of its own.
        { catalogVariantId: 'blue', components: [] },
      ],
    });
    const defaults = await screen.findByRole('region', { name: 'Komposisi bawaan jasa' });
    expect(within(defaults).getByText('Developer 20 vol')).toBeTruthy();
    expect(within(defaults).queryByText('Developer 30 vol')).toBeNull();

    const red = screen.getByRole('region', { name: 'Komposisi khusus varian Red' });
    expect(within(red).getByText('Developer 30 vol')).toBeTruthy();
    expect(within(red).getByText('Komposisi khusus')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Komposisi khusus varian Blue' })).toBeNull();
    expect(screen.getByText(/Varian lain memakai komposisi bawaan: Blue/)).toBeTruthy();
  });

  it('does not invent a default when only a variant has components', async () => {
    renderPanel({
      ...base,
      default: [],
      variantOverrides: [
        {
          catalogVariantId: 'red',
          components: [component({ id: 'dev30', componentName: 'Developer 30 vol' })],
        },
      ],
    });
    expect(await screen.findByText(/Tidak ada komponen bawaan/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Komposisi khusus varian Red' })).toBeTruthy();
  });

  it('is a Service-only concept: a Product never loads or shows a fixed BOM', () => {
    const api = renderPanel({ ...base, default: [], variantOverrides: [] }, { type: 'PRODUCT' });
    expect(screen.queryByRole('region', { name: 'Komponen tetap' })).toBeNull();
    expect(api.getServiceComposition).not.toHaveBeenCalled();
  });

  it('shows a readable failure when the composition cannot be loaded', async () => {
    const api = {
      getServiceComposition: vi.fn(async () => Promise.reject(new Error('boom'))),
    } as unknown as CatalogApi;
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CatalogItemFixedComponents item={{ id: 'svc', type: 'SERVICE' }} api={api} variants={[]} />
      </QueryClientProvider>,
    );
    expect((await screen.findByRole('alert')).textContent).toContain('belum dapat dimuat');
  });
});
