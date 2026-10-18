import {
  DAlert,
  DButton as Button,
  DCombobox as Combobox,
  DDialog as Dialog,
} from '@digvation-labs/ui';
import { X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../../app/localization/operational-localization';
import type {
  CatalogItem,
  ComponentCandidate,
} from '../transaction/model/cashier-transaction.types';
import { correctionErrorMessage } from '../transaction/api/cashier-transaction-errors';
import {
  catalogItemMatchesSearch,
  isStandaloneSellable,
} from '../catalog/selling-catalog-eligibility';
import {
  ItemConfigurator,
  type ItemConfiguration,
  type ItemConfiguratorState,
} from '../cart/item-configurator';

const MAX_SUGGESTIONS = 20;

/**
 * Searchable choice of one standalone sellable item for an existing transaction. It searches the
 * full active catalog it is given (never the POS page's Product/Service tab or search), by item
 * name or code and active variant name or code, the same rules as the selling catalog. Suggestions
 * stay compact: name, then code and type.
 */
export function CatalogItemAutocomplete({
  items,
  value,
  label,
  ariaLabel,
  locale,
  disabled = false,
  onChange,
}: {
  items: readonly CatalogItem[];
  value: string | null;
  label?: string;
  ariaLabel: string;
  locale: string;
  disabled?: boolean;
  onChange: (item: CatalogItem | null) => void;
}) {
  const copy = (text: string) => operationalCopy(text, resolveOperationalLocale(locale));
  const eligible = useMemo(() => items.filter(isStandaloneSellable), [items]);
  const byId = useMemo(() => new Map(eligible.map((item) => [item.id, item])), [eligible]);
  // Searched here rather than by the Combobox, which would only match the visible label: an item
  // is also found by its code and by its active variants.
  const fetchOptions = useCallback(
    async (query: string) => {
      const needle = query.trim().toLocaleLowerCase(locale);
      return eligible
        .filter((item) => catalogItemMatchesSearch(item, needle, locale))
        .slice(0, MAX_SUGGESTIONS)
        .map((item) => ({ value: item.id, label: item.name }));
    },
    [eligible, locale],
  );
  const selected = value ? byId.get(value) : undefined;

  return (
    <Combobox
      {...(label ? { label } : {})}
      ariaLabel={ariaLabel}
      placeholder={copy('Search product or service')}
      value={value}
      // Only the chosen item, so its name shows in the field; suggestions come from fetchOptions.
      options={selected ? [{ value: selected.id, label: selected.name }] : []}
      fetchOptions={fetchOptions}
      debounceMs={0}
      disabled={disabled}
      renderOption={(option) => {
        const item = byId.get(String(option.value));
        if (!item) return option.label;
        return (
          <span className="block min-w-0">
            <span className="block truncate text-sm font-medium">{item.name}</span>
            <span className="block truncate text-xs text-[var(--color-text-muted)]">
              {item.code} · {copy(item.type === 'SERVICE' ? 'Service' : 'Product')}
            </span>
          </span>
        );
      }}
      onChange={(next) => onChange(next === null ? null : (byId.get(String(next)) ?? null))}
    />
  );
}

/**
 * Adds a new item to an existing transaction in one compact dialog: choose the item, configure it
 * with the shared item configuration, then add it. Nothing is persisted until the configuration is
 * valid and confirmed, and no correction reason or impact step applies: nothing is being replaced.
 */
export function AddTransactionItemDialog({
  items,
  locale,
  loadConfiguratorState,
  loadCandidates,
  onConfirm,
  onClose,
}: {
  /** Every active item; the POS page's own filters never apply here. */
  items: readonly CatalogItem[];
  locale: string;
  loadConfiguratorState: (item: CatalogItem) => Promise<ItemConfiguratorState>;
  loadCandidates: (q: string) => Promise<{ items: ComponentCandidate[] }>;
  onConfirm: (item: CatalogItem, configuration: ItemConfiguration) => Promise<unknown>;
  onClose: () => void;
}) {
  const copy = (text: string) => operationalCopy(text, resolveOperationalLocale(locale));
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [state, setState] = useState<ItemConfiguratorState | null>(null);
  const [configuration, setConfiguration] = useState<ItemConfiguration | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the latest selection may fill the configuration.
  const request = useRef(0);

  const choose = (item: CatalogItem | null) => {
    if (item?.id === selected?.id) return;
    // A different item starts fresh: no variant, additions or salesperson carry over.
    const ticket = ++request.current;
    setSelected(item);
    setState(null);
    setConfiguration(null);
    setError(null);
    if (!item) return;
    setLoading(true);
    void loadConfiguratorState(item)
      .then((next) => {
        if (ticket === request.current) setState(next);
      })
      .catch(() => {
        if (ticket === request.current)
          setError(copy('The item could not be loaded. Choose it again.'));
      })
      .finally(() => {
        if (ticket === request.current) setLoading(false);
      });
  };

  const confirm = () => {
    if (!selected || !configuration) return;
    setSubmitting(true);
    setError(null);
    void onConfirm(selected, configuration)
      .then(onClose)
      .catch((reason: unknown) =>
        setError(
          correctionErrorMessage(
            reason,
            copy('The item could not be added. Reload the transaction and try again.'),
            locale,
          ),
        ),
      )
      .finally(() => setSubmitting(false));
  };

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabelledBy="transaction-item-dialog-title"
      closeOnEscape
      closeOnOverlay={false}
      showClose={false}
      noPadding
      overlayClassName="grid place-items-end bg-slate-950/25 backdrop-blur-[2px] sm:place-items-center sm:p-6"
      className="animate-[pos-dialog-in_170ms_ease-out] w-full overflow-hidden rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:min-w-[26rem] sm:max-w-lg sm:rounded-3xl"
    >
      <div className="flex max-h-[80dvh] min-h-0 flex-col">
        <div className="flex items-start justify-between gap-4 px-4 pt-4">
          <h2 id="transaction-item-dialog-title" className="min-w-0 text-lg font-bold leading-snug">
            {copy('Add item')}
          </h2>
          <button
            type="button"
            aria-label={copy('Close')}
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-xl text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
          <CatalogItemAutocomplete
            items={items}
            value={selected?.id ?? null}
            ariaLabel={copy('Search product or service')}
            locale={locale}
            disabled={submitting}
            onChange={choose}
          />
          {state && selected && state.item.id === selected.id ? (
            <ItemConfigurator
              key={state.item.id}
              presentation="inline"
              {...state}
              loadCandidates={loadCandidates}
              onConfigurationChange={setConfiguration}
            />
          ) : loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">{copy('Loading item…')}</p>
          ) : null}
          {error ? <DAlert variant="danger">{error}</DAlert> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 pb-4 pt-3">
          <Button variant="ghost" type="button" onClick={onClose}>
            {copy('Cancel')}
          </Button>
          <Button
            type="button"
            disabled={!configuration || submitting}
            loading={submitting}
            onClick={confirm}
          >
            {copy('Add to order')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
