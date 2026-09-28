import { cn, DTooltip } from '@digvation/ui';
import type { LucideIcon } from 'lucide-react';

/**
 * Workshop icon-only action. Every icon action gets a tooltip, an aria-label
 * and the same hover/focus surface so the same semantic action looks identical
 * on every Workshop screen.
 *
 * Icon convention: `Pencil` edits an existing record, `Trash2` deletes it, and
 * `RefreshCcw` replaces the selected Customer or Vehicle with another one.
 */
export function IconActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <DTooltip content={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-lg border border-transparent text-(--color-text-muted) outline-none transition-colors',
          'hover:border-(--color-border) hover:bg-(--color-surface-muted) focus-visible:border-(--color-brand) focus-visible:ring-2 focus-visible:ring-(--color-brand)/20',
          'disabled:pointer-events-none disabled:opacity-40',
          tone === 'danger' ? 'hover:text-(--color-danger)' : 'hover:text-(--color-text)',
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </DTooltip>
  );
}
