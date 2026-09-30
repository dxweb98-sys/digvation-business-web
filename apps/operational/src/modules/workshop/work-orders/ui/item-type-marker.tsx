import { cn } from '@digvation/ui';
import { Package, Wrench } from 'lucide-react';

import type { WorkshopItemType } from '../api/workshop-lines-api';

/**
 * Service or spare part at a glance. `quiet` is a bare, low-contrast glyph for
 * lists where the item name must lead; the filled tile is for dialogs that
 * need a stronger anchor.
 */
export function ItemTypeMarker({
  type,
  quiet = false,
  active = false,
  className,
}: {
  type: WorkshopItemType;
  quiet?: boolean;
  /** Brand-coloured glyph: the item is selected or in use. */
  active?: boolean;
  className?: string;
}) {
  const Icon = type === 'SERVICE' ? Wrench : Package;
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center',
        quiet
          ? active
            ? 'size-5 text-(--color-brand)'
            : 'size-5 text-(--color-text-muted)/60'
          : type === 'SERVICE'
            ? 'size-9 rounded-xl bg-(--color-brand)/10 text-(--color-brand)'
            : 'size-9 rounded-xl bg-(--color-warning)/15 text-(--color-warning)',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
