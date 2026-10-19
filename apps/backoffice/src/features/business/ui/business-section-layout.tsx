import { DButton, DSkeleton } from '@digvation/ui';
import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';

import { RecordPanel } from '../../../shared/ui/record-dialog';

/**
 * Layout pieces shared by the Business sections. Summary sections compose the record panel
 * family directly; list sections use this heading above their `DDataTable`.
 */
export function BusinessListHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header>
      <h2 className="text-sm font-semibold tracking-tight text-(--color-text)">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm text-(--color-text-muted)">{description}</p>
    </header>
  );
}

/** Loading stand-in shaped like a grid of `RecordInfoTile`s. */
export function TilesSkeleton({ count }: { count: number }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2" role="status" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <DSkeleton key={index} height={68} rounded="lg" />
      ))}
    </div>
  );
}

/** The trailing Edit action of a view-first summary panel. */
export function SectionEditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <DButton
      variant="secondary"
      size="sm"
      leftIcon={<Pencil className="size-4" />}
      onClick={onClick}
    >
      {label}
    </DButton>
  );
}

/**
 * The single form panel of a Business editing dialog, as in the Catalog category dialog. It is a
 * size container, so field grids inside switch to columns by the panel's own width (`@sm:`),
 * not by the viewport.
 */
export function BusinessFormPanel({ children }: { children: ReactNode }) {
  return (
    <RecordPanel className="@container">
      <div className="space-y-4">{children}</div>
    </RecordPanel>
  );
}
