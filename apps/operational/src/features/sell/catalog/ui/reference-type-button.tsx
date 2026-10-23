import { type ReactNode } from 'react';

export function ReferenceTypeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold transition-all duration-200 active:scale-[.98] sm:px-4 ${active ? 'bg-[var(--color-background)] text-[var(--color-brand)] shadow-sm ring-1 ring-[var(--color-border)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-background)]/60 hover:text-[var(--color-text)]'}`}
    >
      {icon}
      {label}
    </button>
  );
}
