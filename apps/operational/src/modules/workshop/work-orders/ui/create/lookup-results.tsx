import { cn, DAlert, DRadio, DSkeleton } from '@digvation/ui';
import type { ReactNode } from 'react';

/** Fixed result-area heights so search never resizes the dialog. */
export const CUSTOMER_RESULTS_HEIGHT = 'h-[192px]';
export const VEHICLE_RESULTS_HEIGHT = 'h-[196px]';

export function ChoiceRow({
  id,
  name,
  leading,
  children,
  selected,
  onSelect,
}: {
  id: string;
  name: string;
  leading: ReactNode;
  children: ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors',
        selected
          ? 'border-(--color-brand) bg-(--color-brand)/5'
          : 'border-(--color-border) bg-(--color-surface) hover:border-(--color-brand)/40 hover:bg-(--color-surface-muted)/40',
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">{children}</div>
      <DRadio
        id={id}
        name={name}
        checked={selected}
        onChange={onSelect}
        className="size-5 shrink-0"
      />
    </label>
  );
}

/**
 * Fixed-height result area shared by Customer and Vehicle lookup. The skeleton
 * only shows before the first result; later searches keep the previous rows
 * (dimmed) until the new ones arrive.
 */
export function LookupResults<T>({
  items,
  isInitialLoading,
  isRefreshing,
  isError,
  errorText,
  emptyText,
  keyOf,
  renderRow,
  heightClass,
}: {
  items: readonly T[] | undefined;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  errorText: string;
  emptyText: string;
  keyOf: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  heightClass: string;
}) {
  return (
    <div className={cn(heightClass, 'overflow-y-auto')} aria-busy={isInitialLoading || isRefreshing}>
      {isInitialLoading ? (
        <div className="space-y-2" aria-hidden="true">
          <DSkeleton count={4} height={56} rounded="lg" className="mb-2" />
        </div>
      ) : isError && !items ? (
        <DAlert variant="danger" title={errorText} />
      ) : (items?.length ?? 0) === 0 ? (
        <p className="grid h-full place-items-center px-6 text-center text-[13px] text-(--color-text-muted)">
          {emptyText}
        </p>
      ) : (
        <ul
          className={cn('space-y-2 transition-opacity duration-150', isRefreshing && 'opacity-60')}
        >
          {items!.map((item) => (
            <li key={keyOf(item)}>{renderRow(item)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
