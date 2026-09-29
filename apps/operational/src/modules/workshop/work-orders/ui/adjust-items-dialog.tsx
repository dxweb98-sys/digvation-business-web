import { formatMoney } from '@digvation/business-money';
import { cn, DBadge, DButton, DDialog } from '@digvation/ui';
import { Plus, Trash2 } from 'lucide-react';

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
import { QuantityStepper } from './quantity-stepper';

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
        'truncate text-sm font-semibold text-(--color-text)',
        removed && 'text-(--color-text-muted) line-through',
      )}
    >
      {name}
      {variantName ? (
        <span className="font-normal text-(--color-text-muted)"> - {variantName}</span>
      ) : null}
    </p>
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

  return (
    <li className="px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ItemName name={line.itemName} variantName={line.variantName} removed={removed} />
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-(--color-text-muted)">
            <DBadge variant="outline">
              {line.itemType === 'SERVICE' ? copy('Service') : copy('Spare part')}
            </DBadge>
            <span className="tabular-nums">
              {removed
                ? copy('Will be removed')
                : `${formatMoney(line.unitPrice, line.currency, locale, 0)} x ${formatQuantity(line.quantity)}`}
            </span>
          </p>
        </div>
        {removed ? (
          <DButton
            variant="outline"
            size="sm"
            aria-label={`${copy('Restore item')} ${label}`}
            onClick={() => onChange(toggleLineRemoval(draft, line.id))}
          >
            {copy('Restore item')}
          </DButton>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <QuantityStepper
              name={label}
              value={quantity}
              onChange={(next) => onChange(setLineQuantity(draft, line, next))}
            />
            <IconActionButton
              icon={Trash2}
              tone="danger"
              touch
              label={`${copy('Remove item')} ${label}`}
              onClick={() => onChange(toggleLineRemoval(draft, line.id))}
            />
          </div>
        )}
      </div>
      {changed && !isValidQuantity(quantity) ? (
        <p role="alert" className="mt-1.5 text-[13px] text-(--color-danger)">
          {copy('Enter a quantity above zero.')}
        </p>
      ) : null}
    </li>
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
    <li className="px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ItemName name={line.itemName} variantName={line.variantName} />
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-(--color-text-muted)">
            <DBadge variant="success">{copy('New')}</DBadge>
            {line.additional ? <span>+ {line.additional.itemName}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <QuantityStepper
            name={label}
            value={line.quantity}
            onChange={(next) =>
              onChange(replaceAddedItem(draft, line.key, { ...line, quantity: next }))
            }
          />
          <IconActionButton
            icon={Trash2}
            tone="danger"
            touch
            label={`${copy('Remove item')} ${label}`}
            onClick={() => onChange(replaceAddedItem(draft, line.key, null))}
          />
        </div>
      </div>
    </li>
  );
}

/**
 * The one place items of an open Work Order are changed. Changes are staged
 * (quantity, removal, additions) and saved together as one atomic set; nothing
 * reaches Runtime until "Save changes".
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

  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="lg"
      ariaLabel={copy('Change items')}
      title={<span className="text-lg font-bold tracking-tight">{copy('Change items')}</span>}
      description={copy('Nothing is saved until you save the changes.')}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-(--color-text-muted)" aria-live="polite">
            {count ? `${count} ${copy('changes')}` : ''}
          </span>
          <div className="flex gap-2">
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
      <div className="space-y-5">
        <section aria-label={copy('Current items')} className="space-y-2">
          <h3 className="text-sm font-semibold text-(--color-text)">{copy('Current items')}</h3>
          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-(--color-border) px-3.5 py-3 text-sm text-(--color-text-muted)">
              {copy('No items on this Work Order.')}
            </p>
          ) : (
            <ul className="divide-y divide-(--color-border) rounded-lg border border-(--color-border)">
              {lines.map((line) => (
                <CurrentRow key={line.id} line={line} draft={draft} onChange={onChange} />
              ))}
            </ul>
          )}
        </section>

        <section aria-label={copy('Items to add')} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-(--color-text)">{copy('Items to add')}</h3>
            <DButton variant="outline" size="sm" onClick={onAddItem} disabled={pending}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="size-4" aria-hidden="true" />
                {copy('Add item')}
              </span>
            </DButton>
          </div>
          {draft.added.length === 0 ? (
            <p className="text-sm text-(--color-text-muted)">{copy('No new items yet.')}</p>
          ) : (
            <ul className="divide-y divide-(--color-border) rounded-lg border border-(--color-border)">
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
