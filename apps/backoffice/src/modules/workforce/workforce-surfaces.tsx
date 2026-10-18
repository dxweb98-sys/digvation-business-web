import { DBadge } from '@digvation/ui';
import type { ReactNode } from 'react';

import {
  serviceEligibilityBlocker,
  serviceEligibilityBlockerCopy,
  type ServiceEligibilityBlocker,
} from './employee-editor-model';
import type { Employee } from './employees-api';
import { useWorkforceLocalization } from './workforce-localization';

/* Workforce-owned composition in the accepted Backoffice dialog language (see Catalog). */

export function WorkforcePanel({
  children,
  ariaLabel,
  className = '',
}: {
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={`overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function WorkforcePanelHeader({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="border-b border-[var(--color-border)] px-5 py-4">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      {description ? (
        <p className="mt-0.5 text-xs leading-5 text-[var(--color-text-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

export function WorkforceDialogTitle({ title, badges }: { title: string; badges?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="size-2 rounded-full bg-[var(--color-brand)]" aria-hidden="true" />
      <span>{title}</span>
      {badges}
    </div>
  );
}

export function EmployeeStatusBadge({ status }: { status: Employee['status'] }) {
  const { copy } = useWorkforceLocalization();
  return (
    <DBadge variant={status === 'ACTIVE' ? 'success' : 'secondary'}>
      {copy(status === 'ACTIVE' ? 'Active' : 'Inactive')}
    </DBadge>
  );
}

/**
 * Whether the employee appears in Operational Service performer selection, with the blocking gate
 * when not. Saved employees are judged by Runtime's canPerformServices.
 */
export function ServiceEligibilityStatus({
  employee,
  compact = false,
}: {
  employee: Pick<
    Employee,
    'status' | 'servicePerformerEligible' | 'position' | 'canPerformServices'
  >;
  compact?: boolean;
}) {
  const { copy } = useWorkforceLocalization();
  const blocker = serviceEligibilityBlocker(employee);
  const eligible = employee.canPerformServices && blocker === null;
  return (
    <div className="min-w-0">
      <DBadge variant={eligible ? 'success' : 'secondary'}>
        {copy(eligible ? 'Can perform services' : 'Cannot perform services')}
      </DBadge>
      {!eligible && blocker ? (
        <p
          className={`mt-1 text-[var(--color-text-muted)] ${compact ? 'text-xs' : 'text-xs leading-5'}`}
        >
          {copy(serviceEligibilityBlockerCopy[blocker as ServiceEligibilityBlocker])}
        </p>
      ) : null}
    </div>
  );
}
