import { DRadio } from '@digvation/ui';
import { Phone, UserCheck } from 'lucide-react';

import type { CustomerLookupResult } from '../customer-member-api';

export interface ExistingCustomerChoiceCopy {
  title: string;
  description: string;
  choose: string;
  unchanged: string;
}

/**
 * Explicit continuation when a phone already belongs to Customer(s) without a Membership.
 * Only name and phone are shown; the operator must pick when there is more than one match.
 */
export function ExistingCustomerChoice({
  candidates,
  selectedId,
  onSelect,
  disabled,
  copy,
}: {
  candidates: readonly CustomerLookupResult[];
  selectedId: string | null;
  onSelect: (customerId: string) => void;
  disabled: boolean;
  copy: ExistingCustomerChoiceCopy;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/[.06] px-4 py-3">
        <div className="flex items-start gap-2">
          <UserCheck className="mt-0.5 size-4 shrink-0 text-[var(--color-brand)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-brand)]">{copy.title}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              {copy.description}
            </p>
          </div>
        </div>
      </div>

      {candidates.length > 1 ? (
        <p className="text-xs font-medium text-[var(--color-text)]">{copy.choose}</p>
      ) : null}
      <fieldset
        disabled={disabled}
        aria-label={copy.title}
        className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]"
      >
        {candidates.map((customer) => (
          <label
            key={customer.id}
            className={`flex cursor-pointer items-center gap-3 px-3 py-3 transition-colors ${
              selectedId === customer.id
                ? 'bg-[var(--color-brand)]/[.07]'
                : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]'
            }`}
          >
            <DRadio
              name="existing-customer"
              checked={selectedId === customer.id}
              onChange={() => onSelect(customer.id)}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{customer.name}</span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                <Phone className="size-3" />
                {customer.phoneE164}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-[var(--color-text-muted)]">{copy.unchanged}</p>
    </div>
  );
}
