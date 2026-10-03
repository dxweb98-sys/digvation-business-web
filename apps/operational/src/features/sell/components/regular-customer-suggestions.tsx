import { DButton, DSkeleton } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { CustomerLookupResult, CustomerMemberApi } from '../customer-member-api';

/** Typed values only search; canonical identity selection is always explicit. */
export function RegularCustomerSuggestions({
  query,
  api,
  enabled,
  selectedId,
  canReadMembers,
  disabled,
  newDisabled,
  text,
  onSelect,
  onNew,
}: {
  query: string;
  api: CustomerMemberApi;
  enabled: boolean;
  selectedId: string | null;
  canReadMembers: boolean;
  disabled: boolean;
  text: (value: string) => string;
  newDisabled: boolean;
  onSelect: (customer: CustomerLookupResult) => void;
  onNew: () => void;
}) {
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const ready = enabled && debounced.length >= 2;
  const result = useQuery({
    queryKey: ['operational-customer-suggestions', api.cacheScope, debounced, canReadMembers],
    queryFn: ({ signal }) => api.searchCustomers(debounced, signal),
    enabled: ready,
  });
  if (!enabled || query.trim().length < 2) return null;
  const pending = query.trim() !== debounced || result.isLoading;
  return (
    <section
      aria-label={text('Customer suggestions')}
      className="rounded-xl border border-(--color-border) p-3"
    >
      <p className="mb-2 text-xs font-semibold text-(--color-text-muted)">
        {text('Customer suggestions')}
      </p>
      {pending ? (
        <div aria-busy="true">
          <DSkeleton height={42} count={2} />
        </div>
      ) : result.isError ? (
        <div role="alert" className="text-xs text-(--color-danger)">
          <p>{text('Customer search could not be completed.')}</p>
          <DButton variant="ghost" size="sm" onClick={() => void result.refetch()}>
            {text('Try again')}
          </DButton>
        </div>
      ) : result.data?.items.length ? (
        <div
          role="listbox"
          aria-label={text('Customer suggestions')}
          className="max-h-44 space-y-1 overflow-y-auto"
        >
          {result.data.items.map((customer) => (
            <button
              key={customer.id}
              type="button"
              role="option"
              aria-selected={selectedId === customer.id}
              disabled={disabled}
              onClick={() => onSelect(customer)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-(--color-surface-muted) ${selectedId === customer.id ? 'bg-(--color-brand)/10 ring-1 ring-(--color-brand)/25' : ''}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{customer.name}</span>
                <span className="block text-xs text-(--color-text-muted)">
                  {customer.phoneE164}
                </span>
              </span>
              {canReadMembers && customer.membership !== undefined ? (
                <span className="shrink-0 text-xs text-(--color-text-muted)">
                  {text(customer.membership ? 'Member' : 'Regular Customer')}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-(--color-text-muted)">{text('No customers found.')}</p>
      )}
      <button
        type="button"
        disabled={disabled || newDisabled}
        onClick={onNew}
        className="mt-2 w-full rounded-lg border border-dashed border-(--color-brand)/30 px-3 py-2 text-left text-xs font-semibold text-(--color-brand) hover:bg-(--color-brand)/5"
      >
        {text('Use as a new customer')}
      </button>
    </section>
  );
}
