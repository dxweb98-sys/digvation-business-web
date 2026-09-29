import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { WorkshopLineAdjustmentEntry } from '../api/workshop-lines-api';
import { historyNewestFirst } from '../model/work-order-line-adjustment-model';
import { formatQuantity } from '../model/work-order-lines-model';

function EntryText({ entry }: { entry: WorkshopLineAdjustmentEntry }) {
  const { copy } = useOperationalLocalization();
  const name = entry.variantName ? `${entry.itemName} - ${entry.variantName}` : entry.itemName;
  if (entry.type === 'ADD')
    return (
      <>
        <span aria-label={copy('Added')}>+</span> {name} x{formatQuantity(entry.quantity)}
      </>
    );
  if (entry.type === 'REMOVE')
    return (
      <>
        <span aria-label={copy('Removed')}>−</span> {name}
      </>
    );
  return (
    <>
      <span className="sr-only">{copy('Quantity changed')}: </span>
      {name} {formatQuantity(entry.previousQuantity ?? '0')} → {formatQuantity(entry.quantity)}
    </>
  );
}

/**
 * Secondary, collapsed trace of item changes after the first selection. It
 * only presents what Runtime recorded; it is not the Work Order timeline.
 */
export function WorkOrderItemHistory({
  entries,
}: {
  entries: readonly WorkshopLineAdjustmentEntry[];
}) {
  const { copy, locale } = useOperationalLocalization();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (entries.length === 0) return null;
  const time = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(value),
    );

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-8 items-center gap-1 rounded-md text-[13px] font-medium text-(--color-text-muted) outline-none transition-colors hover:text-(--color-text) focus-visible:ring-2 focus-visible:ring-(--color-brand)/25"
      >
        <ChevronDown
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
        <span className="text-[13px]">
          {copy('Item change history')} ({entries.length})
        </span>
      </button>
      {open ? (
        <ul id={panelId} className="mt-1.5 space-y-1.5 border-l border-(--color-border) pl-3">
          {historyNewestFirst(entries).map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-(--color-text-muted)"
            >
              <span className="min-w-0 break-words">
                <EntryText entry={entry} />
              </span>
              <time className="tabular-nums" dateTime={entry.adjustedAt}>
                {time(entry.adjustedAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
