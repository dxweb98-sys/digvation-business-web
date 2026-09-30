import { formatMoney } from '@digvation/business-money';
import { cn, DBadge, DButton, DDialog } from '@digvation/ui';
import { PackagePlus, Plus, RotateCcw, Trash2, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { IconActionButton } from '../../shared/ui/icon-action-button';
import type { WorkshopWorkOrderLine } from '../api/workshop-lines-api';
import {
  adjustmentCount,
  adjustmentReady,
  draftQuantity,
  replaceAddedItem,
  setLineQuantity,
  toggleLineRemoval,
  type AdjustmentDraft,
} from '../model/work-order-line-adjustment-model';
import { formatQuantity, isValidQuantity, type DraftLine } from '../model/work-order-lines-model';
import { ItemTypeMarker } from './item-type-marker';
import { QuantityStepper } from './quantity-stepper';
import { SectionMark } from './section-identity';

/** Row treatments: unchanged is quiet; changed, removed and new each carry an accent, a word and an icon. */
const ROW_ACCENT = {
  unchanged: '',
  changed: 'border-l-2 border-l-(--color-brand) bg-(--color-brand)/5',
  removed: 'border-l-2 border-l-(--color-danger) bg-(--color-danger)/5',
  added: 'border-l-2 border-l-(--color-success) bg-(--color-success)/5',
} as const;

function ItemName({
  name,
  variantName,
  removed,
}: {
  name: string;
  variantName: string | null;
  removed?: boolean;
}) {
  return (
    <p
      className={cn(
        'text-sm font-semibold leading-snug text-(--color-text)',
        removed && 'text-(--color-text-muted) line-through decoration-(--color-danger)/60',
      )}
    >
      {name}
      {variantName ? (
        <span className="font-normal text-(--color-text-muted)"> - {variantName}</span>
      ) : null}
    </p>
  );
}

function AdjustRow({
  state,
  marker,
  identity,
  status,
  controls,
}: {
  state: keyof typeof ROW_ACCENT;
  marker: ReactNode;
  identity: ReactNode;
  status?: ReactNode;
  controls: ReactNode;
}) {
  return (
    <li className={cn('px-4 py-3.5', ROW_ACCENT[state])}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
          {marker}
          <div className="min-w-0 flex-1">
            {identity}
            {status ? <div className="mt-1.5">{status}</div> : null}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">{controls}</div>
      </div>
    </li>
  );
}

/** One accepted item: change its quantity or stage its removal (reversible until saved). */
function CurrentRow({
  line,
  draft,
  onChange,
}: {
  line: WorkshopWorkOrderLine;
  draft: AdjustmentDraft;
  onChange: (next: AdjustmentDraft) => void;
}) {
  const { copy, locale } = useOperationalLocalization();
  const removed = draft.removed.includes(line.id);
  const quantity = draftQuantity(line, draft);
  const changed = !removed && quantity !== line.quantity;
  const label = line.variantName ? `${line.itemName} - ${line.variantName}` : line.itemName;
  const typeLabel = line.itemType === 'SERVICE' ? copy('Service') : copy('Spare part');
  const unit = formatMoney(line.unitPrice, line.currency, locale, 0);

  return (
    <AdjustRow
      state={removed ? 'removed' : changed ? 'changed' : 'unchanged'}
      marker={<ItemTypeMarker type={line.itemType} />}
      identity={
        <>
          <ItemName name={line.itemName} variantName={line.variantName} removed={removed} />
          <p className="mt-0.5 text-[13px] text-(--color-text-muted)">
            {typeLabel} · <span className="tabular-nums">{unit}</span>
          </p>
        </>
      }
      status={
        removed ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-(--color-danger)">
            <Trash2 className="size-3.5" aria-hidden="true" />
            {copy('Will be removed')}
          </span>
        ) : changed ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-(--color-brand)">
            {copy('Changed')}: {formatQuantity(line.quantity)} → {formatQuantity(quantity)}
          </span>
        ) : null
      }
      controls={
        removed ? (
          <DButton
            variant="outline"
            aria-label={`${copy('Restore item')} ${label}`}
            onClick={() => onChange(toggleLineRemoval(draft, line.id))}
          >
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {copy('Restore item')}
            </span>
          </DButton>
        ) : (
          <>
            <QuantityStepper
              name={label}
              value={draft.quantities[line.id] ?? formatQuantity(line.quantity)}
              onChange={(next) => onChange(setLineQuantity(draft, line, next))}
            />
            <IconActionButton
              tooltip={false}
              icon={Trash2}
              tone="danger"
              touch
              label={`${copy('Remove item')} ${label}`}
              onClick={() => onChange(toggleLineRemoval(draft, line.id))}
            />
          </>
        )
      }
    />
  );
}

/** An item staged for addition; Runtime resolves its Catalog facts when saved. */
function AddedRow({
  line,
  draft,
  onChange,
}: {
  line: DraftLine;
  draft: AdjustmentDraft;
  onChange: (next: AdjustmentDraft) => void;
}) {
  const { copy } = useOperationalLocalization();
  const label = line.variantName ? `${line.itemName} - ${line.variantName}` : line.itemName;
  return (
    <AdjustRow
      state="added"
      marker={<ItemTypeMarker type={line.itemType} />}
      identity={
        <>
          <ItemName name={line.itemName} variantName={line.variantName} />
          <p className="mt-0.5 text-[13px] text-(--color-text-muted)">
            {line.itemType === 'SERVICE' ? copy('Service') : copy('Spare part')}
            {line.additional ? ` · + ${line.additional.itemName}` : ''}
          </p>
        </>
      }
      status={
        <DBadge variant="success">
          <span className="inline-flex items-center gap-1">
            <PackagePlus className="size-3" aria-hidden="true" />
            {copy('New')}
          </span>
        </DBadge>
      }
      controls={
        <>
          <QuantityStepper
            name={label}
            value={line.quantity}
            onChange={(next) =>
              onChange(replaceAddedItem(draft, line.key, { ...line, quantity: next }))
            }
          />
          <IconActionButton
            tooltip={false}
            icon={Trash2}
            tone="danger"
            touch
            label={`${copy('Remove item')} ${label}`}
            onClick={() => onChange(replaceAddedItem(draft, line.key, null))}
          />
        </>
      }
    />
  );
}

function SectionHeading({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-(--color-text)">{title}</h3>
        {hint ? <span className="text-[12px] text-(--color-text-muted)">{hint}</span> : null}
      </div>
      {action}
    </div>
  );
}

/**
 * The one place items of an open Work Order are changed. Changes are staged
 * (quantity, removal, additions) and saved together as one atomic set; nothing
 * reaches Runtime until "Save changes". The summary in the footer is derived
 * from the draft and is presentation only.
 */
export function AdjustItemsDialog({
  open,
  lines,
  draft,
  pending,
  onChange,
  onAddItem,
  onClose,
  onSave,
}: {
  open: boolean;
  lines: readonly WorkshopWorkOrderLine[];
  draft: AdjustmentDraft;
  pending: boolean;
  onChange: (next: AdjustmentDraft) => void;
  onAddItem: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const count = adjustmentCount(lines, draft);
  const removedCount = draft.removed.length;
  const addedCount = draft.added.length;
  const changedCount = count - removedCount - addedCount;
  const parts = [
    changedCount > 0 ? `${changedCount} ${copy('changed')}` : null,
    removedCount > 0 ? `${removedCount} ${copy('removed')}` : null,
    addedCount > 0 ? `${addedCount} ${copy('new')}` : null,
  ].filter(Boolean);

  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="lg"
      className="[&>div:nth-child(2)]:shrink-0"
      ariaLabel={copy('Change items')}
      title={
        <span className="flex items-center gap-3">
          <SectionMark icon={Wrench} tone="work" />
          <span className="text-lg font-bold tracking-tight">{copy('Change items')}</span>
        </span>
      }
      description={copy('Changes are saved together.')}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0" aria-live="polite">
            {count ? (
              <>
                <p className="text-sm font-semibold text-(--color-text)">
                  {count} {copy('changes')}
                </p>
                <p className="truncate text-[12px] text-(--color-text-muted)">
                  {parts.join(' · ')}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-(--color-text-muted)">{copy('No changes yet.')}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <DButton variant="outline" onClick={onClose} disabled={pending}>
              {copy('Cancel')}
            </DButton>
            <DButton loading={pending} disabled={!adjustmentReady(lines, draft)} onClick={onSave}>
              {copy('Save changes')}
            </DButton>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <section aria-label={copy('Current items')}>
          <SectionHeading title={copy('Current items')} hint={`${lines.length} ${copy('items')}`} />
          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-(--color-border) px-4 py-4 text-sm text-(--color-text-muted)">
              {copy('No items on this Work Order.')}
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-(--color-border) overflow-hidden rounded-xl border border-(--color-border)">
              {lines.map((line) => (
                <CurrentRow key={line.id} line={line} draft={draft} onChange={onChange} />
              ))}
            </ul>
          )}
          {lines.some(
            (line) =>
              !draft.removed.includes(line.id) &&
              draft.quantities[line.id] !== undefined &&
              !isValidQuantity(draft.quantities[line.id]!),
          ) ? (
            <p role="alert" className="mt-2 text-[13px] text-(--color-danger)">
              {copy('Enter a quantity above zero.')}
            </p>
          ) : null}
        </section>

        <section aria-label={copy('Items to add')}>
          <SectionHeading
            title={copy('Items to add')}
            {...(addedCount ? { hint: `${addedCount} ${copy('items')}` } : {})}
            action={
              <DButton variant="outline" onClick={onAddItem} disabled={pending}>
                <span className="inline-flex items-center gap-1.5">
                  <Plus className="size-4" aria-hidden="true" />
                  {copy('Add item')}
                </span>
              </DButton>
            }
          />
          {addedCount === 0 ? (
            <p className="mt-1 rounded-xl border border-dashed border-(--color-border) px-4 py-4 text-sm text-(--color-text-muted)">
              {copy('No new items yet.')}
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-(--color-border) overflow-hidden rounded-xl border border-(--color-border)">
              {draft.added.map((line) => (
                <AddedRow key={line.key} line={line} draft={draft} onChange={onChange} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </DDialog>
  );
}
