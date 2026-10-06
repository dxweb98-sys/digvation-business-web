import { DDropdown as PortalDropdown } from '@digvation/ui';
import { Info } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { type DiscountDetails } from '../model/sale-presentation';

/**
 * Facts explaining one applied Promotion or discount, read from the Sale's own adjustment
 * snapshot. Shared by the Payment Dialog and the Transaction Detail so both explain a discount in
 * the same words; it never looks up the current Promotion.
 */
export function DiscountDetailsContent({
  details,
  locale,
}: {
  details: DiscountDetails;
  locale: string;
}) {
  const { copy } = useOperationalLocalization();
  const when = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  return (
    <div className="space-y-1">
      <p className="font-semibold">
        {details.name ?? copy(details.source === 'PROMOTION' ? 'Promotion' : 'Manual discount')}
      </p>
      {details.percentage ? (
        <p>
          {copy('Discount')}: {details.percentage}%
        </p>
      ) : null}
      {details.scope ? (
        <p>
          {copy(
            details.scope === 'TRANSACTION'
              ? 'Whole transaction'
              : details.scope === 'ITEM'
                ? 'Item-level'
                : 'Category-level',
          )}
        </p>
      ) : null}
      {details.effectiveFrom ? (
        <p>
          {copy('Start')}: {when(details.effectiveFrom)}
        </p>
      ) : null}
      {details.effectiveUntil ? (
        <p>
          {copy('End')}: {when(details.effectiveUntil)}
        </p>
      ) : null}
      {details.reason ? <p>{details.reason}</p> : null}
    </div>
  );
}

export function DiscountInfoTooltip({ label, content }: { label: string; content: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <PortalDropdown
      open={open}
      onOpenChange={setOpen}
      placement="top-start"
      offset={6}
      minWidth={220}
      contentRole="dialog"
      contentPadding={false}
      contentClassName="max-w-72 border-0 bg-[var(--color-tooltip)] px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
      trigger={() => (
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((current) => !current);
          }}
          className="grid size-4 shrink-0 place-items-center rounded-full text-[var(--color-danger)] outline-none transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-200"
        >
          <Info className="size-3.5" />
        </button>
      )}
    >
      {content}
    </PortalDropdown>
  );
}
