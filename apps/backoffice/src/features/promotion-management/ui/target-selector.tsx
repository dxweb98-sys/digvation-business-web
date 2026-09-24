import type { PromotionReferenceOption } from '../../../entities/promotion';

export interface TargetSelectorProps {
  label: string;
  options: PromotionReferenceOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyLabel: string;
  className?: string;
}

export function TargetSelector({
  label,
  options,
  selected,
  onChange,
  emptyLabel,
  className = '',
}: TargetSelectorProps) {
  const selectedSet = new Set(selected);
  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  };

  return (
    <fieldset className={className}>
      <legend className="mb-2 text-sm font-medium text-(--color-text)">{label}</legend>
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-(--radius-control) border border-(--color-border) bg-(--color-surface) p-2">
        {options.length ? (
          options.map((option) => {
            const active = selectedSet.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(option.id)}
                className={[
                  'flex w-full items-center justify-between gap-3 rounded-(--radius-control) px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-(--color-brand)/10 text-(--color-brand)'
                    : 'hover:bg-(--color-surface-muted) text-(--color-text)',
                ].join(' ')}
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{option.name}</span>
                  <span className="ml-2 text-xs text-(--color-text-muted)">{option.code}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold">{active ? '✓' : ''}</span>
              </button>
            );
          })
        ) : (
          <p className="px-3 py-4 text-sm text-(--color-text-muted)">{emptyLabel}</p>
        )}
      </div>
    </fieldset>
  );
}
