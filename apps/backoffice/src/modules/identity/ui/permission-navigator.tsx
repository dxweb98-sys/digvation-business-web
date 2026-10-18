import { DBadge, DButton, DCheckbox, DInput, DSelect } from '@digvation/ui';
import { Search } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';

import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import type { AccessPermission } from '../access-control-api';
import type { PermissionExperience } from '../permission-catalog';
import {
  experienceSummaries,
  permissionCategories,
  selectedIn,
  type PermissionCategory,
} from '../model/permission-navigation';

/**
 * Permission picker in three levels: the access area (Backoffice or Operational), a category of
 * that area, then the permissions of the category. Selection lives in the caller, so it survives
 * switching area or category and searching. A permission that applies to both areas is one key:
 * ticking it in one area ticks it in the other, and counts treat it as one distinct permission.
 *
 * Bulk actions always say what they act on: the open category when browsing, the filtered results
 * when searching. They never touch permissions outside that scope.
 */
const ALL_KEY = '__all__';

export function PermissionNavigator({
  permissions,
  selected,
  readOnly = false,
  onChange,
}: {
  permissions: AccessPermission[];
  selected: ReadonlySet<string>;
  readOnly?: boolean;
  onChange: (keys: string[], checked: boolean) => void;
}) {
  const { copy, locale } = useBackofficeLocalization();
  const [search, setSearch] = useState('');
  const [chosenArea, setChosenArea] = useState<PermissionExperience | null>(null);
  const [activeByArea, setActiveByArea] = useState<Record<string, string | null>>({});

  const all = useMemo(() => permissionCategories(permissions, locale), [permissions, locale]);
  const searching = search.trim().length > 0;
  const visible = useMemo(
    () => (searching ? permissionCategories(permissions, locale, search) : all),
    [all, permissions, locale, search, searching],
  );
  const areas = useMemo(() => experienceSummaries(all, selected), [all, selected]);
  const matches = useMemo(() => experienceSummaries(visible, selected), [visible, selected]);

  // The chosen area wins; while searching, fall back to an area that has matches.
  const matchCount = (area: string) => matches.find((item) => item.key === area)?.total ?? 0;
  const requested = chosenArea ?? areas[0]?.key ?? 'BACKOFFICE';
  const area: PermissionExperience =
    searching && matchCount(requested) === 0
      ? (matches[0]?.key ?? requested)
      : (requested as PermissionExperience);
  const areaLabel = areas.find((item) => item.key === area)?.label ?? area;
  const areaCategories = visible.filter((item) => item.experience === area);
  const totalFor = (key: string) => all.find((item) => item.key === key)?.permissions.length ?? 0;

  // Browsing shows one category; searching shows every matching category of the area until one is picked.
  const activeKey = activeByArea[area] ?? null;
  const focused = areaCategories.find((item) => item.key === activeKey) ?? null;
  const shown: PermissionCategory[] = focused
    ? [focused]
    : searching
      ? areaCategories
      : areaCategories.slice(0, 1);
  const currentKey = focused?.key ?? (searching ? null : (areaCategories[0]?.key ?? null));
  const shownKeys = [...new Set(shown.flatMap((item) => item.permissions.map((p) => p.key)))];
  const shownSelected = shownKeys.filter((key) => selected.has(key)).length;
  const scopeLabel =
    searching && !focused ? `${copy('Results')} · ${areaLabel}` : (shown[0]?.label ?? areaLabel);

  const pickCategory = (key: string | null) => setActiveByArea((map) => ({ ...map, [area]: key }));
  const pickArea = (key: PermissionExperience) => setChosenArea(key);

  const otherArea = matches.find((item) => item.key !== area && item.total > 0);

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = areas.findIndex((item) => item.key === area);
    const next =
      areas[(index + (event.key === 'ArrowRight' ? 1 : -1) + areas.length) % areas.length];
    if (next) pickArea(next.key);
  };

  return (
    <div className="space-y-4">
      <DInput
        type="search"
        value={search}
        onChange={(value) => {
          setSearch(value);
          setActiveByArea({});
        }}
        leftIcon={<Search className="size-4" aria-hidden="true" />}
        placeholder={copy('Search permissions in all areas...')}
        aria-label={copy('Search permissions in all areas...')}
        autoComplete="off"
        clearable
      />

      <div
        role="tablist"
        aria-label={copy('Access area')}
        className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-1"
      >
        {areas.map((item) => {
          const active = item.key === area;
          const count = searching ? matchCount(item.key) : null;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`permission-area-${item.key}`}
              aria-selected={active}
              aria-controls="permission-area-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => pickArea(item.key)}
              onKeyDown={onTabKey}
              className={`flex min-h-12 flex-col items-start justify-center rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ${
                active
                  ? 'bg-[var(--color-surface)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/60'
              }`}
            >
              <span
                className={`text-sm ${
                  active ? 'font-semibold text-[var(--color-text)]' : 'font-medium'
                }`}
              >
                {item.label}
              </span>
              <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                {count === null
                  ? `${item.selected}/${item.total} ${copy('selected')}`
                  : `${count} ${copy('results')}`}
              </span>
            </button>
          );
        })}
      </div>

      <div id="permission-area-panel" role="tabpanel" aria-labelledby={`permission-area-${area}`}>
        {areaCategories.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] px-6 py-8 text-center">
            <p role="status" className="text-sm text-[var(--color-text-muted)]">
              {copy('No permissions found')}
            </p>
            {otherArea ? (
              <DButton size="sm" variant="outline" onClick={() => pickArea(otherArea.key)}>
                {`${copy('Show matches in')} ${otherArea.label} (${otherArea.total})`}
              </DButton>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
            <DSelect
              containerClassName="md:hidden"
              clearable={false}
              aria-label={`${copy('Category')} · ${areaLabel}`}
              value={currentKey ?? ALL_KEY}
              onChange={(value) =>
                pickCategory(value === ALL_KEY || value === null ? null : String(value))
              }
              options={[
                ...(searching
                  ? [
                      {
                        value: ALL_KEY,
                        label: `${copy('All results')} (${matchCount(area)})`,
                      },
                    ]
                  : []),
                ...areaCategories.map((category) => ({
                  value: category.key,
                  label: `${category.label} (${
                    searching
                      ? category.permissions.length
                      : `${selectedIn(category, selected)}/${totalFor(category.key)}`
                  })`,
                })),
              ]}
            />
            <nav
              aria-label={`${copy('Category')} · ${areaLabel}`}
              className="hidden md:flex md:max-h-[clamp(14rem,calc(100vh-36rem),24rem)] md:flex-col md:gap-1 md:overflow-y-auto md:pr-1"
            >
              {searching ? (
                <NavItem
                  active={currentKey === null}
                  label={copy('All results')}
                  badge={String(matchCount(area))}
                  onClick={() => pickCategory(null)}
                />
              ) : null}
              {areaCategories.map((category) => (
                <NavItem
                  key={category.key}
                  active={currentKey === category.key}
                  label={category.label}
                  badge={
                    searching
                      ? String(category.permissions.length)
                      : `${selectedIn(category, selected)}/${totalFor(category.key)}`
                  }
                  emphasised={!searching && selectedIn(category, selected) > 0}
                  onClick={() => pickCategory(category.key)}
                />
              ))}
            </nav>

            <section
              aria-label={scopeLabel}
              className="min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">{scopeLabel}</h3>
                  <p
                    aria-live="polite"
                    className="mt-0.5 text-xs tabular-nums text-[var(--color-text-muted)]"
                  >
                    {shownSelected}/{shownKeys.length} {copy('selected')}
                  </p>
                </div>
                {!readOnly ? (
                  <div className="flex flex-wrap gap-1">
                    <DButton
                      size="sm"
                      variant="outline"
                      aria-label={`${
                        searching && !focused ? copy('Select all results') : copy('Select category')
                      }: ${scopeLabel}`}
                      onClick={() => onChange(shownKeys, true)}
                      disabled={shownSelected === shownKeys.length}
                    >
                      {searching && !focused ? copy('Select all results') : copy('Select category')}
                    </DButton>
                    <DButton
                      size="sm"
                      variant="ghost"
                      aria-label={`${
                        searching && !focused ? copy('Clear results') : copy('Clear category')
                      }: ${scopeLabel}`}
                      onClick={() => onChange(shownKeys, false)}
                      disabled={shownSelected === 0}
                    >
                      {searching && !focused ? copy('Clear results') : copy('Clear category')}
                    </DButton>
                  </div>
                ) : null}
              </header>
              <div className="space-y-4 p-2 md:max-h-[clamp(14rem,calc(100vh-40rem),22rem)] md:overflow-y-auto">
                {shown.map((category) => (
                  <div key={category.key} className="space-y-1">
                    {shown.length > 1 ? (
                      <p className="flex items-center gap-2 px-2 pt-1 text-xs font-semibold text-[var(--color-text-muted)]">
                        <span>{category.label}</span>
                        <DBadge variant="secondary">
                          {selectedIn(category, selected)}/{category.permissions.length}
                        </DBadge>
                      </p>
                    ) : null}
                    <div className="grid gap-x-3 sm:grid-cols-2">
                      {category.permissions.map((permission) => {
                        const checked = selected.has(permission.key);
                        return (
                          <label
                            key={permission.key}
                            className={`flex min-h-11 items-start gap-3 rounded-md px-2 py-2.5 transition-colors ${
                              readOnly
                                ? 'cursor-default'
                                : 'cursor-pointer hover:bg-[var(--color-surface-muted)]'
                            }`}
                          >
                            <DCheckbox
                              checked={checked}
                              onChange={() => onChange([permission.key], !checked)}
                              disabled={readOnly}
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block break-words text-sm leading-5 ${
                                  checked
                                    ? 'font-medium text-[var(--color-text)]'
                                    : 'text-[var(--color-text-muted)]'
                                }`}
                              >
                                {permission.label[locale]}
                              </span>
                              <span className="block break-all text-[11px] text-[var(--color-text-muted)]">
                                {permission.key}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
      {searching ? (
        <p role="status" className="text-xs tabular-nums text-[var(--color-text-muted)]">
          {matches.map((item) => `${item.label}: ${item.total}`).join(' · ') ||
            copy('No permissions found')}{' '}
          {matches.length ? copy('results') : ''}
        </p>
      ) : null}
    </div>
  );
}

function NavItem({
  active,
  label,
  badge,
  emphasised = false,
  onClick,
}: {
  active: boolean;
  label: string;
  badge: string;
  emphasised?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
      className={`flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-[var(--radius-control)] border-l-2 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] md:w-full ${
        active
          ? 'border-[var(--color-brand)] bg-[var(--color-surface-muted)] font-medium text-[var(--color-text)]'
          : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'
      }`}
    >
      <span className="min-w-0 break-words">{label}</span>
      <span
        className={`shrink-0 text-xs tabular-nums ${
          emphasised ? 'font-semibold text-[var(--color-brand)]' : ''
        }`}
      >
        {badge}
      </span>
    </button>
  );
}
