import { DBadge, DButton } from '@digvation/ui';
import { Plus } from 'lucide-react';

import type { CatalogApi } from '../../api/catalog-api';
import type { ComponentProductInfo } from '../api/use-service-composition';
import {
  duplicateComponentKeys,
  newComponentDraft,
  setVariantCustom,
  updateDefaultComponents,
  updateVariantComponents,
  type CompositionComponentDraft,
  type ServiceCompositionDraft,
} from '../model/service-composition-draft';
import type { VariantPriceDraft } from '../model/variant-price-draft';
import { CompositionComponentRow } from './catalog-composition-component-row';

function ComponentList({
  components,
  infoByProduct,
  showIssues,
  disabled,
  api,
  currency,
  effectiveAt,
  onChange,
  label,
}: {
  components: CompositionComponentDraft[];
  infoByProduct: ReadonlyMap<string, ComponentProductInfo>;
  showIssues: boolean;
  disabled: boolean;
  api: CatalogApi;
  currency: string;
  effectiveAt: string;
  onChange: (components: CompositionComponentDraft[]) => void;
  label: string;
}) {
  const duplicateKeys = duplicateComponentKeys(components);
  return (
    <div className="space-y-3">
      {components.length ? (
        <ul aria-label={`Komponen ${label}`} className="space-y-3">
          {components.map((component) => (
            <CompositionComponentRow
              key={component.key}
              component={component}
              info={component.productId ? infoByProduct.get(component.productId) : undefined}
              duplicateKeys={duplicateKeys}
              showIssues={showIssues}
              disabled={disabled}
              api={api}
              currency={currency}
              effectiveAt={effectiveAt}
              onChange={(change) =>
                onChange(components.map((c) => (c.key === component.key ? { ...c, ...change } : c)))
              }
              onRemove={() => onChange(components.filter((c) => c.key !== component.key))}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-4 text-sm text-[var(--color-text-muted)]">
          Belum ada komponen.
        </p>
      )}
      <DButton
        variant="outline"
        size="sm"
        leftIcon={<Plus className="size-4" />}
        disabled={disabled}
        onClick={() => onChange([...components, newComponentDraft()])}
      >
        Tambah komponen
      </DButton>
    </div>
  );
}

export function CatalogItemCompositionSection({
  composition,
  variants,
  infoByProduct,
  loading,
  showIssues,
  disabled,
  api,
  currency,
  effectiveAt,
  onChange,
}: {
  composition: ServiceCompositionDraft;
  variants: VariantPriceDraft[];
  infoByProduct: ReadonlyMap<string, ComponentProductInfo>;
  loading: boolean;
  showIssues: boolean;
  disabled: boolean;
  api: CatalogApi;
  currency: string;
  effectiveAt: string;
  onChange: (composition: ServiceCompositionDraft) => void;
}) {
  const shared = { infoByProduct, showIssues, disabled, api, currency, effectiveAt };

  return (
    <section aria-label="Komponen Jasa" className="space-y-5 p-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Komponen Jasa</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
          Produk yang dipakai saat jasa ini dijual. Komponen tidak muncul sebagai baris terpisah di
          kasir.
        </p>
      </div>

      {loading ? (
        <p className="rounded-xl border border-[var(--color-border)] px-4 py-5 text-sm text-[var(--color-text-muted)]">
          Memuat komponen...
        </p>
      ) : (
        <>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Default
            </h4>
            <ComponentList
              {...shared}
              label="default"
              components={composition.default}
              onChange={(components) => onChange(updateDefaultComponents(composition, components))}
            />
          </div>

          {variants.length ? (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Per Variant
              </h4>
              <ul className="space-y-3">
                {variants.map((variant) => {
                  const state = composition.variants[variant.key];
                  const custom = state?.custom === true;
                  const name = variant.name.trim() || 'Variant baru';
                  return (
                    <li
                      key={variant.key}
                      aria-label={`Variant ${name}`}
                      className="rounded-xl border border-[var(--color-border)] p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--color-text)]">{name}</p>
                        <DBadge variant={custom ? 'info' : 'secondary'}>
                          {custom ? 'Komponen khusus' : 'Komponen default'}
                        </DBadge>
                        <DButton
                          variant="outline"
                          size="sm"
                          className="ml-auto"
                          disabled={disabled}
                          onClick={() =>
                            onChange(setVariantCustom(composition, variant.key, !custom))
                          }
                        >
                          {custom ? 'Gunakan komponen default' : 'Atur khusus untuk variant ini'}
                        </DButton>
                      </div>
                      {custom ? (
                        <div className="mt-3 space-y-3">
                          <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                            Komponen khusus menggantikan seluruh komponen default untuk variant ini.
                          </p>
                          <ComponentList
                            {...shared}
                            label={name}
                            components={state?.components ?? []}
                            onChange={(components) =>
                              onChange(
                                updateVariantComponents(composition, variant.key, components),
                              )
                            }
                          />
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          Variant ini memakai komponen default.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
