import { useAuth } from '@digvation/business-auth';
import { cn, DAlert } from '@digvation/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { useOperationalSession } from '../operational/operational-session-provider';
import { WorkshopIntakeForm } from './workshop-intake-form';
import { WorkshopRecentWorkOrders } from './workshop-intake-recent';
import { canReadWorkshopQueue } from './workshop-queue-actions';

export { canCreateWorkshopCustomer } from './workshop-intake-form';

/**
 * Penerimaan is the intake desk: the Work Order is created right on the page
 * (customer, vehicle, complaint), next to the latest Work Orders of the
 * active branch when the user may read the queue.
 */
export function WorkshopIntakePage() {
  const { session } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy } = useOperationalLocalization();
  const navigate = useNavigate();
  const [createdId, setCreatedId] = useState<string | null>(null);

  const canOpenQueue = canReadWorkshopQueue(session.access.permissions);
  const openQueue = () => void navigate('/workshop/queue');

  return (
    <div className="p-5 md:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
          {copy('Workshop')}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-(--color-text)">{copy('Intake')}</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          {copy('Keluhan / Permintaan Customer sebelum diagnosis mekanik.')}
        </p>
      </header>

      {!selectedLocationId ? (
        <DAlert variant="warning" className="mt-5" title={copy('Select a Location to continue.')} />
      ) : null}

      <div
        className={cn(
          'mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-8',
          canOpenQueue ? 'lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10' : 'max-w-2xl',
        )}
      >
        <WorkshopIntakeForm
          onCreatedChange={setCreatedId}
          {...(canOpenQueue ? { onOpenQueue: openQueue } : {})}
        />
        {canOpenQueue ? (
          <WorkshopRecentWorkOrders onOpenQueue={openQueue} highlightId={createdId} />
        ) : null}
      </div>
    </div>
  );
}
