import { cn, DBadge, DDialog } from '@digvation/ui';
import { History, Minus, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type {
  WorkshopLineAdjustmentEntry,
  WorkshopLineAdjustmentType,
} from '../api/workshop-lines-api';
import { historyNewestFirst } from '../model/work-order-line-adjustment-model';
import { formatQuantity } from '../model/work-order-lines-model';
import { DEPTH_OBJECT } from './item-anatomy';
import { SectionMark } from './section-identity';

const NODE_ICON = { ADD: Plus, QUANTITY_CHANGE: Pencil, REMOVE: Minus } as const;
const NODE_TONE: Record<WorkshopLineAdjustmentType, string> = {
  ADD: 'bg-(--color-success) text-white',
  QUANTITY_CHANGE: 'bg-(--color-brand) text-(--color-brand-foreground)',
  REMOVE: 'bg-(--color-danger) text-white',
};
const LABEL_TONE: Record<WorkshopLineAdjustmentType, string> = {
  ADD: 'text-(--color-success)',
  QUANTITY_CHANGE: 'text-(--color-brand)',
  REMOVE: 'text-(--color-danger)',
};

/**
 * One event on the rail: a semantic node, then a lightly lifted content block.
 * The rail segment below the node reaches the next node, so the line reads as
 * one continuous timeline.
 */
function TimelineEntry({ entry, last }: { entry: WorkshopLineAdjustmentEntry; last: boolean }) {
  const { copy, formatDate } = useOperationalLocalization();
  const Icon = NODE_ICON[entry.type];
  const name = entry.variantName ? `${entry.itemName} - ${entry.variantName}` : entry.itemName;
  const typeLabel =
    entry.type === 'ADD'
      ? copy('Added')
      : entry.type === 'REMOVE'
        ? copy('Removed')
        : copy('Quantity changed');
  const change =
    entry.type === 'ADD'
      ? `+ ${formatQuantity(entry.quantity)}`
      : entry.type === 'REMOVE'
        ? `− ${formatQuantity(entry.previousQuantity ?? '0')}`
        : `${formatQuantity(entry.previousQuantity ?? '0')} → ${formatQuantity(entry.quantity)}`;

  return (
    <li className={cn('relative pl-12', !last && 'pb-5')}>
      {last ? null : (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-4 top-9 w-0.5 -translate-x-1/2 rounded-full bg-(--color-border)"
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0 top-0 grid size-8 place-items-center rounded-full ring-4 ring-(--color-surface)',
          NODE_TONE[entry.type],
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className={cn('rounded-xl px-3.5 py-3', DEPTH_OBJECT)}>
        <p className={cn('text-[12px] font-semibold', LABEL_TONE[entry.type])}>{typeLabel}</p>
        <div className="mt-0.5 flex items-start justify-between gap-3">
          <p className="text-sm font-semibold leading-snug text-(--color-text)">{name}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums text-(--color-text)">
            {change}
          </p>
        </div>
        <p className="mt-1 text-[12px] text-(--color-text-muted)">
          <time dateTime={entry.adjustedAt}>
            {formatDate(new Date(entry.adjustedAt), { dateStyle: 'medium', timeStyle: 'short' })}
          </time>
        </p>
      </div>
    </li>
  );
}

/**
 * Change history of the item list: a compact action that opens a focused
 * dialog with a vertical timeline (newest first). It only presents what
 * Runtime already recorded; it is not the Work Order timeline and adds no
 * request of its own.
 */
export function WorkOrderItemHistory({
  entries,
}: {
  entries: readonly WorkshopLineAdjustmentEntry[];
}) {
  const { copy } = useOperationalLocalization();
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  const title = copy('Item change history');
  const ordered = historyNewestFirst(entries);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-[13px] font-medium text-(--color-text-muted) outline-none transition-colors hover:text-(--color-text) focus-visible:ring-2 focus-visible:ring-(--color-brand)/25"
      >
        <History className="size-4" aria-hidden="true" />
        <span className="text-[13px]">
          {copy('View change history')} ({entries.length})
        </span>
      </button>
      <DDialog
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        className="[&>div:nth-child(2)]:shrink-0"
        ariaLabel={title}
        title={
          <span className="flex items-center gap-3">
            <SectionMark icon={History} tone="history" />
            <span className="text-lg font-bold tracking-tight">{title}</span>
            <DBadge variant="outline">{entries.length}</DBadge>
          </span>
        }
        description={copy('Item changes saved on this Work Order.')}
      >
        <ol className="py-1">
          {ordered.map((entry, index) => (
            <TimelineEntry key={entry.id} entry={entry} last={index === ordered.length - 1} />
          ))}
        </ol>
      </DDialog>
    </>
  );
}
