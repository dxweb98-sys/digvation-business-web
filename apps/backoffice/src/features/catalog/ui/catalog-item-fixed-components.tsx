import { useQuery } from '@tanstack/react-query';
import { Boxes } from 'lucide-react';

import type { CatalogApi, Item, ServiceCompositionComponent, Variant } from '../api/catalog-api';
import { CatalogPanel, CatalogPanelHeader } from './catalog-shared';

const plainQuantity = (value: string) =>
  value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;

function ComponentList({ components }: { components: readonly ServiceCompositionComponent[] }) {
  return (
    <ul className="divide-y divide-[var(--color-border)]/70">
      {components.map((component) => (
        <li
          key={component.id}
          className="flex items-start justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0"
        >
          <span className="min-w-0 break-words text-[var(--color-text)]">
            {component.componentName}
            {component.componentVariantName ? (
              <span className="text-[var(--color-text-muted)]">
                {' '}
                / {component.componentVariantName}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 tabular-nums text-[var(--color-text-muted)]">
            × {plainQuantity(component.quantity)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Read-only view of the CURRENT fixed composition (BOM) of a Service: what it normally uses, and
 * which variants use a different recipe. This is configuration, not what past Sales consumed; the
 * Component Usage report holds that history. Editing stays in Edit Item.
 */
export function CatalogItemFixedComponents({
  item,
  api,
  variants,
}: {
  item: Pick<Item, 'id' | 'type'>;
  api: CatalogApi;
  variants: readonly Variant[];
}) {
  const composition = useQuery({
    queryKey: ['catalog', 'service-composition', item.id],
    queryFn: () => api.getServiceComposition(item.id),
    enabled: item.type === 'SERVICE',
  });
  if (item.type !== 'SERVICE') return null;

  const data = composition.data;
  const overrides = new Map(
    (data?.variantOverrides ?? [])
      .filter((entry) => entry.components.length > 0)
      .map((entry) => [entry.catalogVariantId, entry.components]),
  );
  const activeVariants = variants.filter((variant) => variant.status === 'ACTIVE');
  const overridden = activeVariants.filter((variant) => overrides.has(variant.id));
  const usingDefault = activeVariants.filter((variant) => !overrides.has(variant.id));
  const empty = data && data.default.length === 0 && overridden.length === 0;

  return (
    <CatalogPanel ariaLabel="Komponen tetap">
      <CatalogPanelHeader
        icon={<Boxes className="size-4" aria-hidden="true" />}
        title="Komponen Tetap"
        description="Konfigurasi saat ini. Dicatat pada setiap transaksi jasa ini, tidak tampil ke pelanggan dan tidak menambah harga."
        compact
      />
      <div className="space-y-4 p-4">
        {composition.isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Memuat komponen tetap…</p>
        ) : composition.isError ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            Komponen tetap belum dapat dimuat.
          </p>
        ) : empty ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Belum ada komponen tetap. Tambahkan lewat Edit Item bila jasa ini memakai produk
            tertentu setiap kali dikerjakan.
          </p>
        ) : data ? (
          <>
            <section aria-label="Komposisi bawaan jasa">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
                Bawaan jasa
              </p>
              {data.default.length ? (
                <ComponentList components={data.default} />
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Tidak ada komponen bawaan
                  {overridden.length ? '; hanya varian tertentu yang memakai komponen.' : '.'}
                </p>
              )}
            </section>

            {overridden.map((variant) => (
              <section
                key={variant.id}
                aria-label={`Komposisi khusus varian ${variant.name}`}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-3"
              >
                <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">
                  Varian {variant.name}
                  <span className="ml-2 rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/[.08] px-1.5 py-px align-middle text-[10px] font-semibold text-[var(--color-brand)]">
                    Komposisi khusus
                  </span>
                </p>
                <ComponentList components={overrides.get(variant.id) ?? []} />
              </section>
            ))}

            {overridden.length && usingDefault.length ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                Varian lain memakai komposisi bawaan:{' '}
                {usingDefault.map((variant) => variant.name).join(', ')}.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </CatalogPanel>
  );
}
