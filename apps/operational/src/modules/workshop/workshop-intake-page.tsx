import { useAuth } from '@digvation/business-auth';
import { DAlert, DButton } from '@digvation/ui';
import { ArrowRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router';

import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { useOperationalSession } from '../operational/operational-session-provider';
import { WorkshopIntakeDialog } from './workshop-intake-dialog';
import { canReadWorkshopQueue } from './workshop-queue-actions';

export { canCreateWorkshopCustomer } from './workshop-intake-dialog';

const FLOW_STEPS = [
  { number: '01', name: 'Customer', hint: 'Search or add' },
  { number: '02', name: 'Vehicle', hint: 'Choose or add' },
  { number: '03', name: 'Keluhan', hint: 'Write the complaint' },
] as const;

/**
 * Penerimaan: the page title anchors the page and carries its one primary
 * action; the intake flow is explained as type on the page itself (no wrapping
 * card). The Work Order form lives in a focused dialog.
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

      <section
        aria-labelledby="intake-flow"
        className="mt-8 border-t border-(--color-border) pt-6"
      >
        <h2 id="intake-flow" className="text-sm font-semibold text-(--color-text)">
          {copy('Intake flow')}
        </h2>

        <div className="mt-5 sm:flex sm:items-start sm:justify-between sm:gap-8">
          <ol className="ml-2 space-y-5 border-l border-(--color-border) pl-5 sm:ml-0 sm:flex sm:items-start sm:gap-4 sm:space-y-0 sm:border-l-0 sm:pl-0">
            {FLOW_STEPS.map((step) => (
              <Fragment key={step.number}>
                <li>
                  <p className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold tabular-nums text-(--color-brand)">
                      {step.number}
                    </span>
                    <span className="text-base font-semibold text-(--color-text)">
                      {copy(step.name)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-(--color-text-muted)">{copy(step.hint)}</p>
                </li>
                <li aria-hidden="true" className="hidden pt-1 text-(--color-text-muted) sm:block">
                  <ArrowRight className="h-4 w-4" />
                </li>
              </Fragment>
            ))}
            <li>
              <p className="text-base font-semibold text-(--color-text)">{copy('Queue')}</p>
              <p className="mt-0.5 text-sm text-(--color-text-muted)">{copy('Follow the work')}</p>
            </li>
          </ol>

          {canOpenQueue ? (
            <DButton
              variant="link"
              className="mt-5 justify-start px-0 sm:mt-0 sm:justify-end"
              onClick={openQueue}
            >
              <span className="inline-flex items-center gap-1.5">
                {copy('Open queue')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </DButton>
          ) : null}
        </div>
      </section>

      {isDialogOpen ? (
        <WorkshopIntakeDialog
          onClose={() => setDialogOpen(false)}
          {...(canOpenQueue ? { onOpenQueue: openQueue } : {})}
        />
      ) : null}
    </div>
  );
}
