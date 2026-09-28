import { DAlert, DTextarea } from '@digvation/ui';

import type { WorkshopCustomer } from '../../api/workshop-intake-api';
import type { CreateWorkOrderController } from '../../model/use-create-work-order';
import {
  CustomerIdentity,
  CustomerMarker,
  IdentityBlock,
  VehicleIdentity,
  VehicleMarker,
} from '../../../shared/ui/identity-blocks';
import { SectionHeader } from './create-layout';

/** Step 3: confirmed identities stay compact and quiet; the complaint is the working surface. */
export function SummaryStep({
  intake,
  customer,
  copy,
}: {
  intake: CreateWorkOrderController;
  customer: WorkshopCustomer;
  copy: (value: string) => string;
}) {
  const { selectedVehicle } = intake;

  return (
    <section aria-labelledby="workshop-intake-summary-heading">
      <SectionHeader
        id="workshop-intake-summary-heading"
        title={copy('Complaint & Summary')}
        description={copy('Review the customer and vehicle, then record the complaint.')}
      />

      <div className="mt-4 space-y-2.5">
        <IdentityBlock
          leading={<CustomerMarker name={customer.name} />}
          label={copy('Customer')}
          replaceLabel={copy('Change')}
          onReplace={intake.changeCustomer}
        >
          <CustomerIdentity name={customer.name} phone={customer.phoneE164} />
        </IdentityBlock>
        <IdentityBlock
          leading={<VehicleMarker />}
          label={copy('Vehicle')}
          replaceLabel={copy('Change')}
          onReplace={intake.changeVehicle}
        >
          <VehicleIdentity
            plate={selectedVehicle?.plateNumber ?? intake.plateNumber}
            chassis={selectedVehicle?.chassisNumber ?? intake.chassisNumber}
            engine={selectedVehicle?.engineNumber ?? intake.engineNumber}
            copy={copy}
          />
        </IdentityBlock>
      </div>

      <div className="mt-4 border-t border-(--color-border) pt-4">
        <h4 className="text-base font-bold text-(--color-text)">{copy('Keluhan')}</h4>
        <p className="mt-1 text-[13px] text-(--color-text-muted)">
          {copy('Write the complaint or request from the customer.')}
        </p>
        <DTextarea
          className="mt-3"
          aria-label={copy('Keluhan')}
          value={intake.customerRequest}
          onChange={intake.setCustomerRequest}
          placeholder={copy('For example, rem bunyi')}
          rows={4}
          clearable={false}
        />
      </div>

      {intake.errorMessage ? (
        <DAlert className="mt-4" variant="danger" title={intake.errorMessage} />
      ) : null}
    </section>
  );
}
