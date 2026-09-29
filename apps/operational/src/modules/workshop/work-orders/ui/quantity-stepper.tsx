import { cn, normalizeDecimalInput } from '@digvation/ui';
import { Minus, Plus } from 'lucide-react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { isValidQuantity, stepQuantity } from '../model/work-order-lines-model';

export const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--color-brand)/25';

/** [ − ] 1 [ + ]. Typing stays possible for decimal quantities; the buttons step by one. */
export function QuantityStepper({
  value,
  name,
  onChange,
}: {
  value: string;
  name: string;
  onChange: (next: string) => void;
}) {
  const { copy } = useOperationalLocalization();
  const valid = isValidQuantity(value);
  const button = cn(
    'grid size-10 place-items-center text-(--color-text-muted) transition-colors sm:size-9',
    'hover:bg-(--color-surface-muted) hover:text-(--color-text) disabled:pointer-events-none disabled:opacity-40',
    FOCUS_RING,
  );
  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-lg border bg-(--color-surface)',
        valid ? 'border-(--color-border)' : 'border-(--color-danger)',
      )}
    >
      <button
        type="button"
        className={button}
        aria-label={`${copy('Decrease quantity')} ${name}`}
        disabled={!valid || Number(value) <= 1}
        onClick={() => onChange(stepQuantity(value, -1))}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <input
        inputMode="decimal"
        aria-label={`${copy('Quantity')} ${name}`}
        aria-invalid={!valid}
        value={value}
        onChange={(event) => onChange(normalizeDecimalInput(event.target.value, { scale: 4 }))}
        className={cn(
          'h-10 w-14 bg-transparent text-center text-sm font-semibold tabular-nums text-(--color-text) sm:h-9',
          FOCUS_RING,
        )}
      />
      <button
        type="button"
        className={button}
        aria-label={`${copy('Increase quantity')} ${name}`}
        disabled={!valid}
        onClick={() => onChange(stepQuantity(value, 1))}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
