import { DInfoNote, DInput } from '@digvation/ui';
import { Phone, Search, UserRound } from 'lucide-react';

import type { CreateWorkOrderController } from '../../model/use-create-work-order';
import { CustomerIdentity, CustomerMarker } from '../../../shared/ui/identity-blocks';
import { LookupModeTabs, SectionHeader } from './create-layout';
import { ChoiceRow, CUSTOMER_RESULTS_HEIGHT, LookupResults } from './lookup-results';

export function CustomerStep({
  intake,
  copy,
}: {
  intake: CreateWorkOrderController;
  copy: (value: string) => string;
}) {
  const { customers } = intake;

  return (
    <section aria-labelledby="workshop-intake-customer-heading">
      <SectionHeader
        id="workshop-intake-customer-heading"
        title={copy('Choose customer')}
        description={copy('Find an existing customer or add a new customer.')}
      />

      <LookupModeTabs
        className="mt-4"
        value={intake.customerMode}
        onValueChange={intake.changeCustomerMode}
        tabs={[
          { value: 'existing', label: copy('Find customer') },
          ...(intake.canCreateCustomer
            ? [{ value: 'new' as const, label: copy('New customer') }]
            : []),
        ]}
        panels={{
          existing: (
            <div>
              <DInput
                type="text"
                enterKeyHint="search"
                aria-label={copy('Find customer')}
                leftIcon={<Search className="size-4" aria-hidden="true" />}
                value={intake.customerQuery}
                onChange={intake.setCustomerQuery}
                placeholder={copy('Customer name or phone number...')}
                loading={intake.customersRefreshing && customers.isFetching}
                containerClassName="w-full"
              />

              <p className="mt-4 text-[13px] font-semibold text-(--color-text)">
                {copy('Available customers')}
              </p>

              <div className="mt-2">
                <LookupResults
                  items={customers.data?.items}
                  isInitialLoading={customers.isLoading}
                  isRefreshing={intake.customersRefreshing}
                  isError={customers.isError}
                  errorText={copy('Could not load customers.')}
                  emptyText={copy('No customers found. Try another search.')}
                  keyOf={(customer) => customer.id}
                  heightClass={CUSTOMER_RESULTS_HEIGHT}
                  renderRow={(customer) => (
                    <ChoiceRow
                      id={`workshop-customer-${customer.id}`}
                      name="workshop-customer"
                      leading={<CustomerMarker name={customer.name} />}
                      selected={intake.selectedCustomer?.id === customer.id}
                      onSelect={() => intake.selectCustomer(customer)}
                    >
                      <CustomerIdentity name={customer.name} phone={customer.phoneE164} />
                    </ChoiceRow>
                  )}
                />
              </div>

              {intake.canCreateCustomer ? (
                <DInfoNote
                  variant="info"
                  className="mt-4 rounded-lg border-transparent px-3 py-2.5"
                >
                  {copy('Customer not found? Use the New customer tab to add one.')}
                </DInfoNote>
              ) : null}
            </div>
          ),
          new: (
            <div className="space-y-4">
              <DInput
                label={copy('Name')}
                leftIcon={<UserRound className="size-4" aria-hidden="true" />}
                value={intake.newCustomerName}
                onChange={intake.setNewCustomerName}
                placeholder={copy('Example: Budi Santoso')}
                clearable={false}
                autoComplete="off"
              />
              <DInput
                label={copy('Phone number')}
                leftIcon={<Phone className="size-4" aria-hidden="true" />}
                type="tel"
                inputMode="tel"
                value={intake.newCustomerPhone}
                onChange={intake.setNewCustomerPhone}
                onBlur={() => intake.setPhoneTouched(true)}
                placeholder="0812 3456 7890"
                error={intake.phoneInvalid ? copy('Enter a valid phone number') : undefined}
                clearable={false}
                autoComplete="off"
              />
            </div>
          ),
        }}
      />
    </section>
  );
}
