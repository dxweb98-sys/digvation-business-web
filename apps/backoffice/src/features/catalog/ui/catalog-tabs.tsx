export type CatalogTabOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

export function CatalogTabs<T extends string>({
  value,
  tabs,
  onChange,
  ariaLabel,
}: {
  value: T;
  tabs: Array<CatalogTabOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 pt-3">
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex min-w-0 gap-1 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const selected = value === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.value)}
              className={`border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                selected
                  ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span className="ml-1.5 rounded-full bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px]">
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
