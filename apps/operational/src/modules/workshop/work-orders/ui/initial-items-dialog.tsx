import { formatMoney } from '@digvation/business-money';
import {
  cn,
  DAlert,
  DBadge,
  DButton,
  DDialog,
  DInput,
  DSelect,
  DSkeleton,
  DTabs,
  DTabsList,
  DTabsTrigger,
  normalizeDecimalInput,
} from '@digvation/ui';
import { Check, ChevronDown, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type {
  PickerCandidate,
  PickerFixedComponent,
  PickerItem,
  PickerPrice,
  WorkshopItemType,
  WorkshopLineSelectionInput,
} from '../api/workshop-lines-api';
import {
  activeVariants,
  addToDraft,
  candidatesFor,
  draftIssue,
  draftLineFor,
  draftLinesFor,
  draftReady,
  formatQuantity,
  isConfigurable,
  isSelectableItem,
  isValidQuantity,
  itemHasOwnOption,
  itemPriceHint,
  stepQuantity,
  toSelectionInput,
  type DraftAdditional,
  type DraftLine,
} from '../model/work-order-lines-model';
import { IconActionButton } from '../../shared/ui/icon-action-button';
import { FOCUS_RING, QuantityStepper } from './quantity-stepper';

type TypeFilter = 'ALL' | WorkshopItemType;
const TYPE_FILTERS: readonly TypeFilter[] = ['ALL', 'SERVICE', 'PRODUCT'];
const OWN_ITEM = '__item__';

/** Every Catalog row ends in the same slot so prices line up whatever the action is. */
const ACTION_SLOT = 'grid size-10 shrink-0 place-items-center sm:size-8';

function useTypeLabel() {
  const { copy } = useOperationalLocalization();
  return (type: WorkshopItemType) => (type === 'SERVICE' ? copy('Service') : copy('Spare part'));
}

function PriceText({ price, prefix }: { price: PickerPrice | null; prefix?: string }) {
  const { copy, locale } = useOperationalLocalization();
  if (!price)
    return (
      <span className="text-[13px] text-(--color-text-muted)">{copy('Price not available')}</span>
    );
  return (
    <span className="flex flex-col items-end leading-tight">
      {prefix ? <span className="text-[11px] text-(--color-text-muted)">{prefix}</span> : null}
      <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-(--color-text)">
        {formatMoney(price.amount, price.currency, locale, 0)}
      </span>
    </span>
  );
}

function includesText(components: readonly PickerFixedComponent[]) {
  return components
    .map((component) =>
      [
        component.variantName
          ? `${component.itemName} (${component.variantName})`
          : component.itemName,
        `×${formatQuantity(component.quantity)}`,
      ].join(' '),
    )
    .join(', ');
}

function additionalOptions(candidates: readonly PickerCandidate[]) {
  return candidates.flatMap((candidate) => {
    const withVariants = candidate.variants.map((variant) => ({
      value: `${candidate.id}|${variant.id}`,
      label: `${candidate.name} - ${variant.name}`,
      disabled: !variant.resolvedPrice,
    }));
    const own =
      candidate.variants.length === 0 || candidate.variantSelectionMode === 'OPTIONAL'
        ? [{ value: candidate.id, label: candidate.name, disabled: !candidate.resolvedPrice }]
        : [];
    return [...own, ...withVariants];
  });
}

/**
 * Configure-before-adding panel: identity is the row above, then Variant,
 * included components, the required additional item, quantity and the add
 * action, in that order.
 */
function ConfigurePanel({
  item,
  candidates,
  candidatesLoading,
  candidatesFailed,
  onNeedCandidates,
  onAdd,
}: {
  item: PickerItem;
  candidates: readonly PickerCandidate[];
  candidatesLoading: boolean;
  candidatesFailed: boolean;
  onNeedCandidates: () => void;
  onAdd: (line: DraftLine) => void;
}) {
  const { copy } = useOperationalLocalization();
  const variants = activeVariants(item);
  const ownOption =
    variants.length === 0 || (itemHasOwnOption(item) && Boolean(item.resolvedPrice));
  const [choice, setChoice] = useState<string | null>(() =>
    variants.length === 0
      ? OWN_ITEM
      : variants.length === 1 && !ownOption
        ? (variants[0]?.id ?? null)
        : null,
  );
  const [additional, setAdditional] = useState<DraftAdditional | null>(null);
  const [quantity, setQuantity] = useState('1');
  const requiresAdditional = item.requireAdditionalItemAtSale === true;

  useEffect(() => {
    if (requiresAdditional) onNeedCandidates();
  }, [requiresAdditional, onNeedCandidates]);

  const variant = variants.find((entry) => entry.id === choice) ?? null;
  const price = variant
    ? variant.resolvedPrice
    : choice === OWN_ITEM
      ? (item.resolvedPrice ?? null)
      : null;
  const components = useMemo(
    () =>
      variant?.fixedComponents ?? (choice === OWN_ITEM ? item.fixedComponents : undefined) ?? [],
    [variant, choice, item.fixedComponents],
  );
  const options = useMemo(
    () =>
      additionalOptions(
        candidatesFor(candidates, {
          itemId: item.id,
          includedItemIds: components.map((component) => component.componentItemId),
        }),
      ),
    [candidates, item.id, components],
  );
  const ready =
    choice !== null &&
    price !== null &&
    isValidQuantity(quantity) &&
    (!requiresAdditional || additional !== null);
  const variantChoices = [
    ...variants.map((entry) => ({ id: entry.id, name: entry.name, price: entry.resolvedPrice })),
    ...(variants.length > 0 && ownOption
      ? [{ id: OWN_ITEM, name: copy('No variant'), price: item.resolvedPrice ?? null }]
      : []),
  ];

  return (
    <div className="space-y-4 border-t border-(--color-border) bg-(--color-surface-muted)/60 px-3.5 py-4">
      {variantChoices.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-(--color-text)">
            {copy('Choose a variant')}
          </p>
          <div role="radiogroup" aria-label={copy('Choose a variant')} className="space-y-1.5">
            {variantChoices.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={choice === entry.id}
                disabled={!entry.price}
                onClick={() => setChoice(entry.id)}
                className={cn(
                  'flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border bg-(--color-surface) px-3 py-2 text-left transition-colors',
                  FOCUS_RING,
                  choice === entry.id
                    ? 'border-(--color-brand) ring-1 ring-(--color-brand)/30'
                    : 'border-(--color-border) hover:bg-(--color-surface-muted)',
                  !entry.price && 'cursor-not-allowed opacity-55',
                )}
              >
                <span className="min-w-0 flex-1 text-sm text-(--color-text)">{entry.name}</span>
                <PriceText price={entry.price} />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {components.length > 0 ? (
        <p className="text-[13px] leading-snug text-(--color-text-muted)">
          <span className="font-semibold text-(--color-text)">{copy('Includes')}: </span>
          {includesText(components)}
        </p>
      ) : null}

      {requiresAdditional ? (
        candidatesFailed ? (
          <DAlert variant="danger" title={copy('Could not load additional items.')} />
        ) : (
          <DSelect
            label={copy('Additional item')}
            hint={copy('This service needs one additional item.')}
            placeholder={copy('Choose an additional item')}
            searchable
            loading={candidatesLoading}
            options={options}
            value={
              additional
                ? additional.variantId
                  ? `${additional.itemId}|${additional.variantId}`
                  : additional.itemId
                : null
            }
            onValueChange={(value) => {
              if (typeof value !== 'string') return setAdditional(null);
              const [itemId = '', variantId] = value.split('|');
              const candidate = candidates.find((entry) => entry.id === itemId);
              setAdditional(
                candidate
                  ? { itemId, itemName: candidate.name, variantId: variantId ?? null }
                  : null,
              );
            }}
          />
        )
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-(--color-text)">{copy('Quantity')}</span>
          <QuantityStepper value={quantity} name={item.name} onChange={setQuantity} />
        </div>
        <DButton
          size="sm"
          disabled={!ready}
          onClick={() => onAdd({ ...draftLineFor(item, variant), quantity, additional })}
        >
          <span className="inline-flex items-center gap-1.5">
            <Plus className="size-4" aria-hidden="true" />
            {copy('Add item')}
          </span>
        </DButton>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  expanded,
  selectedLines,
  candidates,
  candidatesLoading,
  candidatesFailed,
  onNeedCandidates,
  onToggle,
  onAdd,
}: {
  item: PickerItem;
  expanded: boolean;
  selectedLines: number;
  candidates: readonly PickerCandidate[];
  candidatesLoading: boolean;
  candidatesFailed: boolean;
  onNeedCandidates: () => void;
  onToggle: () => void;
  onAdd: (line: DraftLine) => void;
}) {
  const { copy } = useOperationalLocalization();
  const typeLabel = useTypeLabel();
  const configurable = isConfigurable(item);
  const hint = itemPriceHint(item);
  const selected = selectedLines > 0;
  const unavailable = !configurable && hint.kind === 'none';
  const components = configurable ? [] : (item.fixedComponents ?? []);

  const identity = (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="break-words text-sm font-semibold text-(--color-text)">{item.name}</span>
        {selected && configurable ? <DBadge variant="success">{copy('Selected')}</DBadge> : null}
      </span>
      <span className="mt-0.5 block text-[13px] text-(--color-text-muted)">
        {typeLabel(item.type)} · {item.code}
      </span>
      {components.length ? (
        <span className="mt-0.5 block text-[13px] leading-snug text-(--color-text-muted)">
          {copy('Includes')}: {includesText(components)}
        </span>
      ) : null}
    </span>
  );
  const price =
    hint.kind === 'none' ? (
      configurable ? null : (
        <PriceText price={null} />
      )
    ) : (
      <PriceText
        price={hint.price}
        {...(hint.kind === 'from' ? { prefix: copy('Starts from') } : {})}
      />
    );

  return (
    <li className={cn(selected && !configurable && 'bg-(--color-brand)/5')}>
      {configurable ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className={cn(
            'flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-(--color-surface-muted)',
            FOCUS_RING,
            expanded && 'bg-(--color-surface-muted)/60',
          )}
        >
          {identity}
          {price}
          <span className={ACTION_SLOT}>
            <ChevronDown
              className={cn(
                'size-5 text-(--color-text-muted) transition-transform',
                expanded && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </span>
        </button>
      ) : (
        <div className="flex min-h-14 items-center gap-3 px-3.5 py-3">
          {identity}
          {price}
          {selected ? (
            <span
              role="img"
              aria-label={copy('Selected')}
              className={cn(ACTION_SLOT, 'text-(--color-brand)')}
            >
              <Check className="size-5" aria-hidden="true" />
            </span>
          ) : (
            <IconActionButton
              icon={Plus}
              tone="brand"
              touch
              disabled={unavailable}
              label={`${copy('Add')} ${item.name}`}
              onClick={() => onAdd(draftLineFor(item, null))}
            />
          )}
        </div>
      )}
      {configurable && expanded ? (
        <ConfigurePanel
          item={item}
          candidates={candidates}
          candidatesLoading={candidatesLoading}
          candidatesFailed={candidatesFailed}
          onNeedCandidates={onNeedCandidates}
          onAdd={onAdd}
        />
      ) : null}
    </li>
  );
}

function DraftRow({
  line,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  onChange: (next: DraftLine) => void;
  onRemove: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const typeLabel = useTypeLabel();
  const issue = draftIssue(line);

  return (
    <li className="flex flex-col gap-2.5 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold text-(--color-text)">{line.itemName}</p>
        <p className="mt-0.5 text-[13px] text-(--color-text-muted)">
          {typeLabel(line.itemType)}
          {line.variantName ? ` · ${line.variantName}` : ''}
        </p>
        {line.additional ? (
          <p className="text-[13px] text-(--color-text-muted)">
            {copy('Additional item')}: {line.additional.itemName}
          </p>
        ) : null}
        {line.includes.length ? (
          <p className="text-[13px] leading-snug text-(--color-text-muted)">
            {copy('Includes')}: {line.includes.join(', ')}
          </p>
        ) : null}
        {issue === 'quantity' ? (
          <p className="mt-1 text-[13px] text-(--color-danger)">
            {copy('Enter a quantity above zero.')}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <QuantityStepper
          value={line.quantity}
          name={line.itemName}
          onChange={(quantity) => onChange({ ...line, quantity })}
        />
        <IconActionButton
          icon={Trash2}
          touch
          tone="danger"
          label={`${copy('Remove')} ${line.itemName}`}
          onClick={onRemove}
        />
      </div>
    </li>
  );
}

/**
 * Initial Work Order item selection. The draft lives only in this dialog and is
 * never authoritative: it holds Catalog identities and quantities, and Runtime
 * re-resolves names, prices and composition when the whole set is submitted.
 */
export function InitialItemsDialog({
  open,
  items,
  loading,
  failed,
  candidates,
  candidatesLoading,
  candidatesFailed,
  pending,
  onWantCandidates,
  onRetry,
  onClose,
  onConfirm,
  mode = 'initial',
}: {
  open: boolean;
  items: readonly PickerItem[] | undefined;
  loading: boolean;
  failed: boolean;
  candidates: readonly PickerCandidate[] | undefined;
  candidatesLoading: boolean;
  candidatesFailed: boolean;
  pending: boolean;
  onWantCandidates: () => void;
  onRetry: () => void;
  onClose: () => void;
  /** Receives the selection intent and the browser drafts it came from (names for display). */
  onConfirm: (lines: WorkshopLineSelectionInput[], drafts: readonly DraftLine[]) => void;
  /** `add` reuses the same picker to add items to an already accepted Work Order. */
  mode?: 'initial' | 'add';
}) {
  const { copy, locale } = useOperationalLocalization();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Every opening starts from an empty draft (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSearch('');
      setTypeFilter('ALL');
      setDraft([]);
      setExpandedId(null);
    }
  }

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(locale);
    return (items ?? []).filter(
      (item) =>
        isSelectableItem(item) &&
        (typeFilter === 'ALL' || item.type === typeFilter) &&
        (!needle || `${item.name} ${item.code}`.toLocaleLowerCase(locale).includes(needle)),
    );
  }, [items, locale, search, typeFilter]);

  const typeLabel: Record<TypeFilter, string> = {
    ALL: copy('All'),
    SERVICE: copy('Service'),
    PRODUCT: copy('Spare part'),
  };

  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="lg"
      ariaLabel={mode === 'add' ? copy('Add item') : copy('Select items')}
      title={
        <span className="text-lg font-bold tracking-tight">
          {mode === 'add' ? copy('Add item') : copy('Select items')}
        </span>
      }
      description={
        mode === 'add'
          ? copy('Choose what to add to this Work Order.')
          : copy('Choose the services and spare parts for this Work Order.')
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-(--color-text-muted)" aria-live="polite">
            {draft.length ? `${draft.length} ${copy('items selected')}` : ''}
          </span>
          <div className="flex gap-2">
            <DButton variant="outline" onClick={onClose} disabled={pending}>
              {copy('Cancel')}
            </DButton>
            <DButton
              loading={pending}
              disabled={!draftReady(draft)}
              onClick={() => onConfirm(toSelectionInput(draft), draft)}
            >
              {mode === 'add' ? copy('Add to list') : copy('Save items')}
            </DButton>
          </div>
        </div>
      }
    >
      {failed ? (
        <div>
          <DAlert variant="danger" title={copy('Could not load the catalog.')} />
          <DButton variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            {copy('Retry')}
          </DButton>
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-label={copy('Search and add items')} className="space-y-3">
            <h3 className="text-sm font-semibold text-(--color-text)">
              {copy('Search and add items')}
            </h3>
            <DInput
              aria-label={copy('Search services or spare parts')}
              placeholder={copy('Search services or spare parts')}
              leftIcon={<Search className="size-4" aria-hidden="true" />}
              value={search}
              onChange={setSearch}
              clearable
            />
            <DTabs
              value={typeFilter}
              defaultValue="ALL"
              onValueChange={(value) => setTypeFilter(value as TypeFilter)}
            >
              <DTabsList aria-label={copy('Type')} className="flex w-max gap-0.5">
                {TYPE_FILTERS.map((type) => (
                  <DTabsTrigger key={type} value={type} className="px-3 py-1.5 text-[13px]">
                    {typeLabel[type]}
                  </DTabsTrigger>
                ))}
              </DTabsList>
            </DTabs>

            {loading ? (
              <div className="space-y-2" aria-busy="true">
                <DSkeleton className="h-14 w-full" />
                <DSkeleton className="h-14 w-full" />
                <DSkeleton className="h-14 w-full" />
              </div>
            ) : visible.length === 0 ? (
              <p className="rounded-lg border border-dashed border-(--color-border) px-4 py-6 text-center text-sm text-(--color-text-muted)">
                {copy('No services or spare parts match your search.')}
              </p>
            ) : (
              <ul
                className={cn(
                  'divide-y divide-(--color-border) overflow-y-auto rounded-xl border border-(--color-border)',
                  !expandedId && 'max-h-[min(22rem,45dvh)]',
                )}
              >
                {visible.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    expanded={expandedId === item.id}
                    selectedLines={draftLinesFor(draft, item.id)}
                    candidates={candidates ?? []}
                    candidatesLoading={candidatesLoading}
                    candidatesFailed={candidatesFailed}
                    onNeedCandidates={onWantCandidates}
                    onToggle={() =>
                      setExpandedId((current) => (current === item.id ? null : item.id))
                    }
                    onAdd={(line) => {
                      setDraft((current) => addToDraft(current, line));
                      setExpandedId(null);
                    }}
                  />
                ))}
              </ul>
            )}
          </section>

          <section
            aria-label={copy('Selected items')}
            className="border-t border-(--color-border) pt-5"
          >
            {draft.length === 0 ? (
              <p className="text-sm text-(--color-text-muted)">{copy('No items selected')}.</p>
            ) : (
              <div className="rounded-xl bg-(--color-surface-muted)/70">
                <div className="flex items-baseline justify-between gap-3 px-3.5 pb-1 pt-3">
                  <h3 className="text-sm font-semibold text-(--color-text)">
                    {copy('Selected items')}
                  </h3>
                  <span className="text-[13px] text-(--color-text-muted)">
                    {draft.length} {copy('items')}
                  </span>
                </div>
                <ul className="divide-y divide-(--color-border)">
                  {draft.map((line) => (
                    <DraftRow
                      key={line.key}
                      line={line}
                      onChange={(next) =>
                        setDraft((current) =>
                          current.map((entry) => (entry.key === line.key ? next : entry)),
                        )
                      }
                      onRemove={() =>
                        setDraft((current) => current.filter((entry) => entry.key !== line.key))
                      }
                    />
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </DDialog>
  );
}
