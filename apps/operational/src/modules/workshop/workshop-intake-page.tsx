import { useAuth } from '@digvation/business-auth';
import { DAlert, DButton } from '@digvation/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { useOperationalSession } from '../operational/operational-session-provider';
import { WorkshopIntakeDialog } from './workshop-intake-dialog';
import { WorkshopRecentWorkOrders } from './workshop-intake-recent';
import { canReadWorkshopQueue } from './workshop-queue-actions';

export { canCreateWorkshopCustomer } from './workshop-intake-dialog';

const FLOW_STEPS = [
  { number: '01', name: 'Customer' },
  { number: '02', name: 'Vehicle' },
  { number: '03', name: 'Keluhan' },
] as const;

/**
 * Penerimaan is an Operational workspace: the title carries the one primary
 * action, the main column shows the latest Work Orders of the active branch
 * (when the user may read the queue), and the intake flow is a narrow,
 * secondary guide. The Work Order form lives in a focused dialog.
 */
export function WorkshopIntakePage() {
  const { session } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy } = useOperationalLocalization();
  const navigate = useNavigate();
  const [isDialogOpen, setDialogOpen] = useState(false);

  const canOpenQueue = canReadWorkshopQueue(session.access.permissions);
  const openQueue = () => void navigate('/workshop/queue');

  return (
    <div className="p-5 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
            {copy('Workshop')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-(--color-text)">{copy('Intake')}</h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            {copy('Keluhan / Permintaan Customer sebelum diagnosis mekanik.')}
          </p>
        </div>
        <DButton
          className="w-full sm:w-auto"
          disabled={!selectedLocationId}
          onClick={() => setDialogOpen(true)}
        >
          {copy('Create Work Order')}
        </DButton>
      </header>

      {!selectedLocationId ? (
        <DAlert variant="warning" className="mt-5" title={copy('Select a Location to continue.')} />
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
        {canOpenQueue ? <WorkshopRecentWorkOrders onOpenQueue={openQueue} /> : null}

        <aside
          aria-labelledby="intake-flow"
          className={canOpenQueue ? 'max-lg:border-t max-lg:border-(--color-border) max-lg:pt-6' : ''}
        >
          <h2 id="intake-flow" className="text-sm font-semibold text-(--color-text)">
            {copy('Intake flow')}
          </h2>
          <ol className="ml-2 mt-4 space-y-4 border-l border-(--color-border) pl-5">
            {FLOW_STEPS.map((step) => (
              <li key={step.number} className="flex items-baseline gap-2">
                <span className="text-xs font-semibold tabular-nums text-(--color-brand)">
                  {step.number}
                </span>
                <span className="text-sm font-medium text-(--color-text)">{copy(step.name)}</span>
              </li>
            ))}
            {canOpenQueue ? (
              <li className="text-sm font-medium text-(--color-text-muted)">{copy('Queue')}</li>
            ) : null}
          </ol>
        </aside>
      </div>

      {isDialogOpen ? (
        <WorkshopIntakeDialog
          onClose={() => setDialogOpen(false)}
          {...(canOpenQueue ? { onOpenQueue: openQueue } : {})}
        />
      ) : null}
    </div>
  );
}
