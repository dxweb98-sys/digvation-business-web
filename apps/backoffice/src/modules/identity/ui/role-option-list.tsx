import { DCheckbox } from '@digvation/ui';

import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import type { AccessRole } from '../access-control-api';

/**
 * Role selection as labelled options: name, a one-line meaning, and the role code, so an
 * administrator can tell roles apart without opening the Roles tab.
 */
export function RoleOptionList({
  roles,
  selected,
  disabled = false,
  invalid = false,
  onToggle,
}: {
  roles: AccessRole[];
  selected: string[];
  disabled?: boolean;
  invalid?: boolean;
  onToggle: (roleId: string) => void;
}) {
  const { copy } = useBackofficeLocalization();
  return (
    <div
      role="group"
      aria-label={copy('Roles')}
      className={`divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-control)] border ${
        invalid ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
      }`}
    >
      {roles.map((role) => (
        <label
          key={role.id}
          className="flex cursor-pointer items-start gap-3 px-3 py-3 text-sm hover:bg-[var(--color-surface-muted)]"
        >
          <DCheckbox
            checked={selected.includes(role.id)}
            onChange={() => onToggle(role.id)}
            disabled={disabled}
          />
          <span className="min-w-0 flex-1">
            <span className="block break-words font-medium text-[var(--color-text)]">
              {role.name}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
              {role.systemKey === 'OWNER'
                ? copy('Full access to the whole organization. Only an Owner can grant it.')
                : `${role.permissions.length} ${copy('permissions')} · ${role.code}`}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
