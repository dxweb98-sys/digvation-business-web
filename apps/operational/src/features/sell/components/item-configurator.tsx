import { formatMoney } from '@digvation/pos-money';
import {
  DButton as Button,
  DCombobox as Combobox,
  DDialog as Dialog,
  DSelect as Select,
  DToggle as Toggle,
} from '@digvation-labs/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Minus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../../app/localization/operational-localization';
import type { CartDraftAdditionalItem, CartDraftSalesperson } from '../cart-draft';
import type { CatalogItem, CatalogVariant, ComponentCandidate } from '../cashier-transaction.types';
import {
  additionalItemsOf,
  additionalRowIssue,
  additionalUnitPrice,
  candidateStubsFromAdditions,
  candidatesForRow,
  configuratorReadiness,
  fixedComponentsFor,
  isValidQuantity,
  ITEM_OPTION,
  newAdditionalRow,
  newUnitConfig,
  priceSummary,
  priceSummaryUnits,
  resizeUnits,
  rowsFromAdditions,
  unitCountOf,
  stepQuantity,
  variantRequirement,
  type AdditionalRow,
  type UnitConfig,
} from '../item-configurator-model';
import { additionSignature } from '../cart-draft';

/** A Runtime-approved Product salesperson candidate. */
export interface SalespersonOption {
  id: string;
  name: string;
}

export interface ItemConfiguratorState {
  item: CatalogItem;
  /**
   * Runtime-filtered ACTIVE, Product-sales-eligible employees. Only meaningful for a Product;
   * absent for a Service, which has performers instead of a salesperson.
   */
  salespeople?: readonly SalespersonOption[];
  /** Active variants; empty when the item is sold directly. */
  variants: readonly CatalogVariant[];
  /** Present only when the item itself is also sold without a variant. */
  itemOption?: { price: string | null } | null;
  /** Resolved price when the item has no variants. */
  itemPrice: string | null;
  pricesByVariantId?: Readonly<Record<string, string>>;
  unavailableVariantIds?: readonly string[];
  locale?: string;
  currency?: string;
}

export interface ItemConfiguration {
  catalogVariantId: string | null;
  quantity: string;
  /** Additions shared by every unit; empty when the units differ (see `unitAdditions`). */
  additionalComponents: CartDraftAdditionalItem[];
  /** One entry per unit, present only when the units of a whole quantity are configured differently. */
  unitAdditions?: CartDraftAdditionalItem[][];
  /** Product only and optional; absent means no salesperson. */
  soldBy?: CartDraftSalesperson | null;
}

interface ItemConfiguratorProps extends ItemConfiguratorState {
  /** Reopens an existing cart line: base variant, quantity and chosen additions come prefilled. */
  initial?: ItemConfiguration;
  /** Primary action label; defaults to adding to the cart. */
  confirmLabel?: string;
  loadCandidates?: (q: string) => Promise<{ items: ComponentCandidate[] }>;
  /**
   * `dialog` (default) is the stand-alone add/edit dialog. `inline` renders only the shared
   * configuration (variant, quantity, per-unit additions, price summary) for a host that owns the
   * shell, such as an item correction, and reports it through `onConfigurationChange`.
   */
  presentation?: 'dialog' | 'inline';
  onConfigurationChange?: (configuration: ItemConfiguration | null) => void;
  onConfirm?: (configuration: ItemConfiguration) => void;
  onClose?: () => void;
}

const NO_ELIGIBLE_ADDITIONS =
  'No eligible additional items are available for this branch. Set a selling price for a Product in Backoffice, then try again.';

function trimQuantity(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}

const control =
  'grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50';

function QuantityStepper({
  value,
  onChange,
  label,
  copy,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  copy: (value: string) => string;
  compact?: boolean;
}) {
  const valid = isValidQuantity(value);
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        className={compact ? control.replace('size-11', 'size-10') : control}
        aria-label={copy('Decrease quantity')}
        onClick={() => onChange(stepQuantity(value, -1))}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <input
        inputMode="decimal"
        aria-label={label}
        aria-invalid={!valid}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-11 w-20 rounded-xl border bg-[var(--color-surface)] text-center text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 ${
          valid ? 'border-[var(--color-border)]' : 'border-[var(--color-danger)]'
        } ${compact ? 'h-10 w-16' : ''}`}
      />
      <button
        type="button"
        className={compact ? control.replace('size-11', 'size-10') : control}
        aria-label={copy('Increase quantity')}
        onClick={() => onChange(stepQuantity(value, 1))}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function AdditionalItemRow({
  row,
  rows,
  fixed,
  baseItemId,
  known,
  loadCandidates,
  onDiscover,
  onChange,
  onRemove,
  copy,
  money,
}: {
  baseItemId: string;
  row: AdditionalRow;
  rows: readonly AdditionalRow[];
  fixed: ReturnType<typeof fixedComponentsFor>;
  known: ReadonlyMap<string, ComponentCandidate>;
  loadCandidates: (q: string) => Promise<{ items: ComponentCandidate[] }>;
  onDiscover: (candidates: ComponentCandidate[]) => void;
  onChange: (change: Partial<AdditionalRow>) => void;
  onRemove: () => void;
  copy: (value: string) => string;
  money: (amount: string) => string;
}) {
  const [search, setSearch] = useState('');
  const results = useQuery({
    queryKey: ['item-configurator', 'candidates', search.trim()],
    queryFn: () => loadCandidates(search.trim()),
    staleTime: 15_000,
  });
  const found = results.data?.items;
  useEffect(() => {
    if (found) onDiscover(found);
  }, [found, onDiscover]);

  const selected = row.candidateId ? known.get(row.candidateId) : undefined;
  const offered = useMemo(() => {
    const list = candidatesForRow(found ?? [], fixed, rows, row.key, baseItemId);
    return selected && !list.some((candidate) => candidate.id === selected.id)
      ? [selected, ...list]
      : list;
  }, [found, fixed, rows, row.key, selected, baseItemId]);
  const issue = additionalRowIssue(row, selected);
  const requirement = selected ? variantRequirement(selected) : 'NONE';
  const price = additionalUnitPrice(row, selected);

  return (
    <li className="space-y-3 rounded-xl border border-[var(--color-border)] p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Combobox
            ariaLabel={copy('Search additional item')}
            placeholder={copy('Search additional item')}
            value={row.candidateId}
            options={offered.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            loading={results.isFetching}
            onSearchChange={setSearch}
            idleMessage={copy('Search by item name or code.')}
            onChange={(value) =>
              onChange({
                candidateId: typeof value === 'string' ? value : null,
                variantId: null,
              })
            }
          />
        </div>
        <button
          type="button"
          className={control}
          aria-label={copy('Remove additional item')}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>

      {selected && selected.variants.length ? (
        <Select
          label={copy('Variant')}
          value={row.variantId}
          placeholder={copy('Choose a variant')}
          clearable={requirement !== 'REQUIRED'}
          options={selected.variants.map((variant) => ({
            value: variant.id,
            label: variant.resolvedPrice
              ? `${variant.name} (${money(variant.resolvedPrice.amount)})`
              : `${variant.name} (${copy('Price unavailable')})`,
            disabled: variant.resolvedPrice === null,
          }))}
          onChange={(value) => onChange({ variantId: typeof value === 'string' ? value : null })}
          className="w-full"
        />
      ) : null}

      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <QuantityStepper
            compact
            value={row.quantity}
            label={copy('Additional item')}
            copy={copy}
            onChange={(quantity) => onChange({ quantity })}
          />
          <p
            className={`text-sm font-semibold ${
              issue === 'PRICE_UNAVAILABLE'
                ? 'text-[var(--color-danger)]'
                : 'text-[var(--color-text)]'
            }`}
          >
            {price
              ? money(price)
              : issue === 'VARIANT_REQUIRED'
                ? copy('Choose a variant')
                : copy('Price unavailable')}
          </p>
        </div>
      ) : null}
    </li>
  );
}

export function ItemConfigurator({
  item,
  variants,
  itemOption = null,
  itemPrice,
  pricesByVariantId = {},
  unavailableVariantIds = [],
  salespeople,
  locale = 'id-ID',
  currency = 'IDR',
  initial,
  confirmLabel,
  loadCandidates,
  presentation = 'dialog',
  onConfigurationChange,
  onConfirm,
  onClose,
}: ItemConfiguratorProps) {
  const copy = (value: string) => operationalCopy(value, resolveOperationalLocale(locale));
  const money = (amount: string) => formatMoney(amount, currency, locale, 0);
  const hasVariants = variants.length > 0;
  // Item-level rule (Product or Service): a required item is always sold with additions.
  const additionalRequired = item.requireAdditionalItemAtSale === true;
  const supportsAdditions = Boolean(loadCandidates);

  const [choice, setChoice] = useState<string | null>(() =>
    !initial ? null : (initial.catalogVariantId ?? (itemOption ? ITEM_OPTION : null)),
  );
  const [quantity, setQuantity] = useState(() => (initial ? trimQuantity(initial.quantity) : '1'));
  // Optional Product salesperson. Null is a valid, complete choice.
  const [soldBy, setSoldBy] = useState<CartDraftSalesperson | null>(initial?.soldBy ?? null);
  const showSalesperson = item.type === 'PRODUCT' && salespeople !== undefined;
  const salespersonOptions = useMemo(() => {
    const options = (salespeople ?? []).map((entry) => ({ value: entry.id, label: entry.name }));
    // A reopened line keeps its seller visible even if they are no longer a candidate.
    return soldBy && !options.some((option) => option.value === soldBy.employeeId)
      ? [{ value: soldBy.employeeId, label: soldBy.name }, ...options]
      : options;
  }, [salespeople, soldBy]);
  // Every quantity unit has its own additions: a whole quantity of 2 can be two different
  // configurations. Fractional or very large quantities are a single configuration.
  const [units, setUnits] = useState<UnitConfig[]>(() => {
    const count = unitCountOf(initial ? trimQuantity(initial.quantity) : '1');
    const stored =
      initial?.unitAdditions ??
      Array.from({ length: count }, () => initial?.additionalComponents ?? []);
    return [...Array(count).keys()].map((index) =>
      newUnitConfig(additionalRequired, rowsFromAdditions(stored[index] ?? [])),
    );
  });
  const [activeUnit, setActiveUnit] = useState(0);
  const [known, setKnown] = useState<ReadonlyMap<string, ComponentCandidate>>(
    () =>
      new Map(
        candidateStubsFromAdditions([
          ...(initial?.additionalComponents ?? []),
          ...(initial?.unitAdditions?.flat() ?? []),
        ]).map((candidate) => [candidate.id, candidate]),
      ),
  );
  const unitCount = unitCountOf(quantity);
  const unitIndex = Math.min(activeUnit, unitCount - 1);
  const current = units[unitIndex] ?? newUnitConfig(additionalRequired);
  const useAdditions = current.enabled;
  const rows = current.rows;
  const changeQuantity = (next: string) => {
    setQuantity(next);
    // Growing adds fresh, empty units (never a silent copy); shrinking keeps the leading units.
    setUnits((existing) => resizeUnits(existing, unitCountOf(next), additionalRequired));
  };
  const setRows = (update: (rows: AdditionalRow[]) => AdditionalRow[]) =>
    setUnits((existing) =>
      existing.map((unit, index) =>
        index === unitIndex ? { ...unit, rows: update(unit.rows) } : unit,
      ),
    );
  const toggleAdditions = (enabled: boolean) => {
    if (additionalRequired) return;
    // Turning it off discards this unit's draft; turning it on starts with one empty row.
    setUnits((existing) =>
      existing.map((unit, index) =>
        index === unitIndex
          ? { ...unit, enabled, rows: enabled ? [newAdditionalRow()] : [] }
          : unit,
      ),
    );
  };
  const copyToAllUnits = () =>
    setUnits((existing) =>
      existing.map((unit, index) =>
        index === unitIndex
          ? unit
          : {
              ...unit,
              enabled: current.enabled,
              rows: current.rows.map((row) => ({
                ...row,
                key: `additional-${Math.random().toString(36).slice(2)}`,
              })),
            },
      ),
    );
  const eligibility = useQuery({
    queryKey: ['item-configurator', 'candidates', ''],
    queryFn: () => loadCandidates!(''),
    staleTime: 15_000,
    enabled: supportsAdditions && units.some((unit) => unit.enabled),
  });
  const discover = useMemo(
    () => (candidates: ComponentCandidate[]) =>
      setKnown((current) => {
        if (candidates.every((candidate) => current.get(candidate.id) === candidate))
          return current;
        const next = new Map(current);
        for (const candidate of candidates) next.set(candidate.id, candidate);
        return next;
      }),
    [],
  );

  const choices = [
    ...(itemOption
      ? [
          {
            id: ITEM_OPTION,
            name: copy('Without variant'),
            detail: copy('Sold as the item itself'),
            price: itemOption.price ?? undefined,
            unavailable: itemOption.price === null,
          },
        ]
      : []),
    ...variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      detail: variant.code,
      price: pricesByVariantId[variant.id],
      unavailable: unavailableVariantIds.includes(variant.id),
    })),
  ];
  const selectedVariant =
    choice && choice !== ITEM_OPTION
      ? (variants.find((variant) => variant.id === choice) ?? null)
      : null;
  const selectionPrice = !hasVariants
    ? itemPrice
    : choice === null
      ? null
      : choice === ITEM_OPTION
        ? (itemOption?.price ?? null)
        : (pricesByVariantId[choice] ?? null);
  const fixed = hasVariants && choice === null ? [] : fixedComponentsFor(item, selectedVariant);
  const candidates = useMemo(() => [...known.values()], [known]);
  const noEligibleCandidates =
    eligibility.data !== undefined &&
    candidatesForRow(eligibility.data.items, fixed, [], '', item.id).length === 0;
  const effectiveUnits = units.slice(0, unitCount);
  const unitReadiness = effectiveUnits.map((unit) =>
    configuratorReadiness({
      needsVariantChoice: hasVariants,
      selectedVariantChoice: choice,
      selectionPrice,
      quantity,
      additionalRequired,
      rows: unit.enabled ? unit.rows : [],
      candidates,
      noEligibleCandidates,
    }),
  );
  const readiness = {
    // Every unit must satisfy the requirement before the item can be confirmed.
    ready: unitReadiness.every((entry) => entry.ready),
    additionalMissing: unitReadiness.some((entry) => entry.additionalMissing),
  };
  const unitAdditions = effectiveUnits.map((unit) =>
    unit.enabled ? additionalItemsOf(unit.rows, candidates) : [],
  );
  const unitStarted = effectiveUnits.map(
    (unit) => unit.enabled && unit.rows.filter((row) => row.candidateId !== null).length,
  );
  const unitIssue = unitReadiness.map(
    (entry, index) =>
      entry.additionalMissing ||
      Number(unitStarted[index] ?? 0) > (unitAdditions[index]?.length ?? 0),
  );
  const additional = unitAdditions[unitIndex] ?? [];
  const startedRows = Number(unitStarted[unitIndex] ?? 0);
  const heterogeneous =
    unitCount > 1 && new Set(unitAdditions.map((entry) => additionSignature(entry))).size > 1;
  const anyAdditions = unitAdditions.some((entry) => entry.length > 0);
  const showSummary =
    selectionPrice !== null && (anyAdditions || (isValidQuantity(quantity) && quantity !== '1'));
  const summary = selectionPrice
    ? priceSummary({
        servicePrice: selectionPrice,
        additional: unitAdditions[0] ?? [],
        quantity,
      })
    : null;
  const unitSummary =
    selectionPrice && heterogeneous
      ? priceSummaryUnits({ basePrice: selectionPrice, unitAdditions, quantity })
      : null;
  const total = unitSummary?.total ?? summary?.total ?? null;
  const blocker = readiness.ready
    ? null
    : hasVariants && choice === null
      ? copy('Select variant')
      : additionalRequired && noEligibleCandidates
        ? copy(NO_ELIGIBLE_ADDITIONS)
        : readiness.additionalMissing
          ? copy('Choose at least one additional item.')
          : startedRows > additional.length || unitIssue.some(Boolean)
            ? copy('Complete or remove the unfinished additional item.')
            : selectionPrice === null
              ? copy('Price for this selection is unavailable.')
              : null;

  const updateRow = (key: string, change: Partial<AdditionalRow>) =>
    setRows((existing) => existing.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const configurationPayload: ItemConfiguration = {
    catalogVariantId: choice === null || choice === ITEM_OPTION ? null : choice,
    quantity: quantity.trim(),
    // Identical units stay one configuration; different ones are kept apart.
    additionalComponents: heterogeneous ? [] : (unitAdditions[0] ?? []),
    ...(heterogeneous ? { unitAdditions } : {}),
    ...(showSalesperson && soldBy ? { soldBy } : {}),
  };
  // Embedded use (an item correction): the host reads the configuration as it changes.
  const emitted = readiness.ready ? JSON.stringify(configurationPayload) : null;
  useEffect(() => {
    onConfigurationChange?.(emitted ? (JSON.parse(emitted) as ItemConfiguration) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitted]);

  const sections = (
    <>
      {hasVariants ? (
        <section aria-label={copy(itemOption ? 'Select option' : 'Select variant')}>
          <p className="mb-2 text-sm font-semibold">
            {copy(itemOption ? 'Select option' : 'Select variant')}
          </p>
          <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]">
            {choices.map((entry) => {
              const selected = choice === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={entry.unavailable}
                  onClick={() => setChoice(entry.id)}
                  aria-pressed={selected}
                  className={`flex min-h-12 w-full items-center justify-between gap-4 px-3.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? 'bg-[var(--color-brand)]/7 shadow-[inset_2px_0_0_var(--color-brand)]'
                      : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]/60'
                  }`}
                >
                  <span className="min-w-0 truncate text-sm font-semibold">{entry.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    {entry.unavailable ? (
                      <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                        {copy('Price unavailable')}
                      </span>
                    ) : entry.price ? (
                      <span className="text-sm font-semibold">{money(entry.price)}</span>
                    ) : null}
                    <span
                      className={`grid size-4 place-items-center rounded-full border ${
                        selected
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                          : 'border-[var(--color-border)] text-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      <Check className="size-2.5" />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section
        aria-label={copy('Item quantity')}
        className="flex items-center justify-between gap-4"
      >
        <p className="text-sm font-semibold">{copy('Item quantity')}</p>
        <QuantityStepper
          value={quantity}
          label={copy('Item quantity')}
          copy={copy}
          onChange={changeQuantity}
        />
      </section>

      {showSalesperson ? (
        <section aria-label={copy('Sold by')}>
          <Select
            label={copy('Sold by')}
            value={soldBy?.employeeId ?? null}
            placeholder={copy('No salesperson')}
            clearable
            searchable
            options={salespersonOptions}
            onChange={(value) => {
              const chosen = salespersonOptions.find((option) => option.value === value);
              setSoldBy(
                typeof value === 'string' && chosen
                  ? { employeeId: value, name: chosen.label }
                  : null,
              );
            }}
            hint={copy('Optional. The salesperson earns commission when the sale is completed.')}
            className="w-full"
          />
        </section>
      ) : null}

      {unitCount > 1 && loadCandidates ? (
        <section aria-label={copy('Unit configuration')} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{copy('Configure each unit')}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {copy('Each unit can have different additional items.')}
              </p>
            </div>
            <p className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-text-muted)]">
              {unitIssue.filter((issue) => !issue).length} {copy('of')} {unitCount}{' '}
              {copy('units ready')}
            </p>
          </div>
          {/* One row per unit, scrolling inside its own box: it stays compact at any quantity. */}
          <ol
            aria-label={copy('Units')}
            className="max-h-44 divide-y divide-[var(--color-border)] overflow-y-auto overscroll-contain rounded-xl border border-[var(--color-border)]"
          >
            {effectiveUnits.map((unit, index) => {
              const incomplete = unitIssue[index];
              const chosen = unitAdditions[index] ?? [];
              const active = index === unitIndex;
              return (
                <li key={unit.key}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setActiveUnit(index)}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm transition-colors ${
                      active
                        ? 'bg-[var(--color-brand)]/7 shadow-[inset_2px_0_0_var(--color-brand)]'
                        : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]/60'
                    }`}
                  >
                    <span
                      className={`shrink-0 font-semibold ${active ? 'text-[var(--color-brand)]' : ''}`}
                    >
                      {copy('Unit')} {index + 1}
                    </span>
                    <span
                      className={`flex min-w-0 items-center gap-1.5 text-xs ${
                        incomplete
                          ? 'font-semibold text-[var(--color-warning)]'
                          : 'text-[var(--color-text-muted)]'
                      }`}
                    >
                      {incomplete ? (
                        <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                      ) : chosen.length ? (
                        <Check
                          className="size-3.5 shrink-0 text-[var(--color-success)]"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="truncate">
                        {incomplete
                          ? copy('Incomplete')
                          : chosen.length
                            ? chosen.map((entry) => entry.label).join(', ')
                            : copy('No additional items')}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className={control.replace('size-11', 'size-10')}
              aria-label={copy('Previous unit')}
              disabled={unitIndex === 0}
              onClick={() => setActiveUnit(unitIndex - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <p className="text-sm font-semibold tabular-nums">
              {copy('Unit')} {unitIndex + 1} {copy('of')} {unitCount}
            </p>
            <button
              type="button"
              className={control.replace('size-11', 'size-10')}
              aria-label={copy('Next unit')}
              disabled={unitIndex === unitCount - 1}
              onClick={() => setActiveUnit(unitIndex + 1)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {fixed.length ? (
        <section aria-label={copy('Included components')}>
          <p className="mb-1.5 text-sm font-semibold">{copy('Included components')}</p>
          <ul className="space-y-0.5 text-sm text-[var(--color-text-muted)]">
            {fixed.map((component) => (
              <li key={`${component.componentItemId}:${component.componentVariantId ?? ''}`}>
                {component.itemName}
                {component.variantName ? ` / ${component.variantName}` : ''} ×{' '}
                {component.quantity.replace(/\.?0+$/, '')}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loadCandidates ? (
        <section aria-label={copy('Additional items')} className="space-y-2">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                {copy('Use additional items')}
                {unitCount > 1 ? ` · ${copy('Unit')} ${unitIndex + 1}` : ''}
              </span>
              {additionalRequired ? (
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {copy('Additional items are required for this item.')}
                </span>
              ) : null}
            </span>
            <Toggle
              ariaLabel={copy('Use additional items')}
              checked={useAdditions}
              disabled={additionalRequired}
              onChange={toggleAdditions}
            />
          </div>
          {useAdditions && readiness.additionalMissing && !noEligibleCandidates ? (
            <p className="text-xs text-[var(--color-warning)]">
              {copy('Choose at least one additional item.')}
            </p>
          ) : null}
          {useAdditions && additionalRequired && noEligibleCandidates ? (
            <p role="alert" className="text-xs text-[var(--color-danger)]">
              {copy(NO_ELIGIBLE_ADDITIONS)}
            </p>
          ) : null}
          {useAdditions ? (
            <>
              <ul className="space-y-2">
                {rows.map((row) => (
                  <AdditionalItemRow
                    key={row.key}
                    row={row}
                    rows={rows}
                    fixed={fixed}
                    baseItemId={item.id}
                    known={known}
                    loadCandidates={loadCandidates}
                    onDiscover={discover}
                    onChange={(change) => updateRow(row.key, change)}
                    onRemove={() =>
                      setRows((existing) =>
                        existing.length > 1
                          ? existing.filter((entry) => entry.key !== row.key)
                          : [newAdditionalRow()],
                      )
                    }
                    copy={copy}
                    money={money}
                  />
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                type="button"
                leftIcon={<Plus className="size-3.5" />}
                onClick={() => setRows((existing) => [...existing, newAdditionalRow()])}
              >
                {copy('Add another item')}
              </Button>
              {unitCount > 1 ? (
                <Button variant="ghost" size="sm" type="button" onClick={copyToAllUnits}>
                  {copy('Apply to all units')}
                </Button>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {showSummary && summary && total !== null ? (
        <dl
          aria-label={copy('Item total')}
          className="space-y-1 rounded-xl bg-[var(--color-surface-muted)]/60 p-3 text-sm"
        >
          {unitSummary ? (
            unitSummary.unitAmounts.map((amount, index) => (
              <div key={index} className="flex justify-between gap-4">
                <dt className="text-[var(--color-text-muted)]">
                  {copy('Unit')} {index + 1}
                </dt>
                <dd>{money(amount)}</dd>
              </div>
            ))
          ) : additional.length ? (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-text-muted)]">{copy('Item price')}</dt>
                <dd>{money(selectionPrice ?? '0')}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-text-muted)]">{copy('Additional items total')}</dt>
                <dd>+ {money(summary.additionalUnit)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-text-muted)]">{copy('Price per unit')}</dt>
                <dd>{money(summary.unit)}</dd>
              </div>
            </>
          ) : null}
          <div className="flex justify-between gap-4 font-semibold">
            <dt>{copy('Item total')}</dt>
            <dd data-testid="configurator-total">{money(total)}</dd>
          </div>
        </dl>
      ) : null}
    </>
  );

  if (presentation === 'inline')
    return (
      <div className="space-y-4">
        {sections}
        {blocker ? (
          <p role="status" className="text-xs text-[var(--color-text-muted)]">
            {blocker}
          </p>
        ) : null}
      </div>
    );

  return (
    <Dialog
      open
      onClose={() => onClose?.()}
      ariaLabelledBy="item-configurator-title"
      closeOnEscape
      closeOnOverlay
      showClose={false}
      noPadding
      overlayClassName="grid place-items-end bg-slate-950/25 backdrop-blur-[2px] sm:place-items-center sm:p-6"
      className="animate-[pos-dialog-in_170ms_ease-out] w-full overflow-hidden rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:min-w-[26rem] sm:max-w-lg sm:rounded-3xl"
    >
      <div className="flex max-h-[80dvh] min-h-0 flex-col">
        <div className="flex items-start justify-between gap-4 px-4 pt-4">
          <div className="min-w-0">
            <h2 id="item-configurator-title" className="text-lg font-bold leading-snug">
              {item.name}
            </h2>
            <p className="mt-0.5 text-lg font-semibold text-[var(--color-brand)]">
              {selectionPrice !== null ? money(selectionPrice) : ' '}
            </p>
          </div>
          <button
            type="button"
            aria-label={copy('Close')}
            onClick={() => onClose?.()}
            className="grid size-11 shrink-0 place-items-center rounded-xl text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
          {sections}
        </div>

        <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-3">
          {blocker ? (
            <p role="status" className="mb-2 text-xs text-[var(--color-text-muted)]">
              {blocker}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => onClose?.()}>
              {copy('Cancel')}
            </Button>
            <Button
              type="button"
              disabled={!readiness.ready}
              onClick={() => onConfirm?.(configurationPayload)}
            >
              {confirmLabel ?? copy(initial ? 'Save changes' : 'Add to cart')}
              {readiness.ready && showSummary && total !== null ? ` · ${money(total)}` : ''}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
