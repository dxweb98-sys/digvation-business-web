import { Info } from 'lucide-react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { AdditionDiscountNote as NoteKind } from '../model/sale-presentation';

const MESSAGE: Record<Exclude<NoteKind, null>, string> = {
  ITEM_ONLY:
    'The item discount applies only to the main item price. Additional items are not discounted.',
  ITEM_AND_TRANSACTION:
    'The item discount applies only to the main item price. Additional items share only the transaction discount.',
};

/** A quiet, inline explanation under a discounted line that has sale-selected additions. */
export function AdditionDiscountNote({
  kind,
  className = '',
}: {
  kind: NoteKind;
  className?: string;
}) {
  const { copy } = useOperationalLocalization();
  if (!kind) return null;
  return (
    <p
      className={`flex items-start gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)] ${className}`}
    >
      <Info aria-hidden="true" className="mt-px size-3 shrink-0" />
      <span>{copy(MESSAGE[kind])}</span>
    </p>
  );
}
