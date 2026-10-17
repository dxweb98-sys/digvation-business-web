import { DCheckbox } from '@digvation/ui';

import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import type { AccessRole } from '../access-control-api';

/** True when the selection grants the Owner system role. */
export function selectsOwner(roles: AccessRole[], selected: string[]): boolean {
  return roles.some((role) => role.systemKey === 'OWNER' && selected.includes(role.id));
}

/**
 * Explicit confirmation shown only while Owner is selected. Owner access is whole-organization;
 * other roles combined with it never reduce it.
 */
export function OwnerGrantNotice({
  confirmed,
  invalid = false,
  disabled = false,
  onConfirmedChange,
}: {
  confirmed: boolean;
  invalid?: boolean;
  disabled?: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
}) {
  const { copy } = useBackofficeLocalization();
  return (
    <div
      className={`mt-3 rounded-[var(--radius-control)] border px-3 py-3 text-sm ${
        invalid ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
      } bg-[var(--color-surface-muted)]/50`}
    >
      <p className="text-xs leading-5 text-[var(--color-text-muted)]">
        {copy(
          'Owner gives full access to the whole organization. Adding other roles does not reduce it.',
        )}
      </p>
      <label className="mt-2 flex cursor-pointer items-start gap-3">
        <DCheckbox
          checked={confirmed}
          onChange={() => onConfirmedChange(!confirmed)}
          disabled={disabled}
        />
        <span className="min-w-0 font-medium text-[var(--color-text)]">
          {copy('I confirm this person becomes an Owner.')}
        </span>
      </label>
      {invalid ? (
        <p role="alert" className="mt-1.5 text-xs text-[var(--color-danger)]">
          {copy('Confirm the Owner role to continue.')}
        </p>
      ) : null}
    </div>
  );
}
