import { DInput } from '@digvation/ui';
import { Cog, Hash, Search } from 'lucide-react';

import type { WorkshopCustomer } from '../../api/workshop-intake-api';
import type { CreateWorkOrderController } from '../../model/use-create-work-order';
import {
  CustomerIdentity,
  CustomerMarker,
  IdentityBlock,
  VehicleIdentity,
  VehicleMarker,
} from '../../../shared/ui/identity-blocks';
import { LookupModeTabs, SectionHeader } from './create-layout';
import { ChoiceRow, LookupResults, VEHICLE_RESULTS_HEIGHT } from './lookup-results';
import { PlateField } from './plate-field';

export function VehicleStep({
  intake,
  customer,
  copy,
}: {
  intake: CreateWorkOrderController;
  customer: WorkshopCustomer;
  copy: (value: string) => string;
}) {
  const { vehicles } = intake;

  return (
    <section aria-labelledby="workshop-intake-vehicle-heading">
      <IdentityBlock
        leading={<CustomerMarker name={customer.name} />}
        label={copy('Customer')}
        replaceLabel={copy('Change')}
        onReplace={intake.changeCustomer}
      >
        <CustomerIdentity name={customer.name} phone={customer.phoneE164} />
      </IdentityBlock>

      <div className="mt-5">
        <SectionHeader
          id="workshop-intake-vehicle-heading"
          title={copy('Choose vehicle')}
          description={copy('Select a saved vehicle or add a new vehicle.')}
        />
      </div>

      <LookupModeTabs
        className="mt-4"
        value={intake.vehicleMode}
        onValueChange={intake.changeVehicleMode}
        tabs={[
          { value: 'existing', label: copy('Saved vehicles') },
          { value: 'new', label: copy('New vehicle') },
        ]}
        panels={{
          existing: (
            <div>
              <DInput
                type="text"
                enterKeyHint="search"
                aria-label={copy('Saved vehicles')}
                leftIcon={<Search className="size-4" aria-hidden="true" />}
                value={intake.vehicleQuery}
                onChange={intake.setVehicleQuery}
                placeholder={copy('Search plate, chassis, or engine number')}
                loading={intake.vehiclesRefreshing && vehicles.isFetching}
                containerClassName="w-full"
              />

              <div className="mt-3">
                <LookupResults
                  items={vehicles.data?.items}
                  isInitialLoading={vehicles.isLoading}
                  isRefreshing={intake.vehiclesRefreshing}
                  isError={vehicles.isError}
                  errorText={copy('Could not load vehicles.')}
                  emptyText={copy('No saved vehicles found. Use the New vehicle tab to add one.')}
                  keyOf={(vehicle) => vehicle.id}
                  heightClass={VEHICLE_RESULTS_HEIGHT}
                  renderRow={(vehicle) => (
                    <ChoiceRow
                      id={`workshop-vehicle-${vehicle.id}`}
                      name="workshop-vehicle"
                      leading={<VehicleMarker />}
                      selected={intake.selectedVehicle?.id === vehicle.id}
                      onSelect={() => intake.setSelectedVehicle(vehicle)}
                    >
                      <VehicleIdentity
                        plate={vehicle.plateNumber}
                        chassis={vehicle.chassisNumber}
                        engine={vehicle.engineNumber}
                        copy={copy}
                      />
                    </ChoiceRow>
                  )}
                />
              </div>
            </div>
          ),
          new: (
            <div className="space-y-4">
              <PlateField
                label={copy('Plate number')}
                parts={intake.plateParts}
                onChange={intake.setPlateParts}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <DInput
                  label={copy('Chassis number')}
                  leftIcon={<Hash className="size-4" aria-hidden="true" />}
                  value={intake.chassisNumber}
                  onChange={intake.setChassisNumber}
                  placeholder={copy('Enter chassis number')}
                  clearable={false}
                  autoComplete="off"
                />
                <DInput
                  label={copy('Engine number')}
                  leftIcon={<Cog className="size-4" aria-hidden="true" />}
                  value={intake.engineNumber}
                  onChange={intake.setEngineNumber}
                  placeholder={copy('Enter engine number')}
                  clearable={false}
                  autoComplete="off"
                />
              </div>
            </div>
          ),
        }}
      />
    </section>
  );
}
