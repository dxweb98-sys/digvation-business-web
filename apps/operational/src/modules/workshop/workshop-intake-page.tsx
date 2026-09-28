import { useAuth } from '@digvation/business-auth';
import { DAlert, DButton } from '@digvation/ui';
import { ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { useOperationalSession } from '../operational/operational-session-provider';
import { WorkshopIntakeDialog } from './workshop-intake-dialog';
import { canReadWorkshopQueue } from './workshop-queue-actions';

export { canCreateWorkshopCustomer } from './workshop-intake-dialog';

/**
 * Penerimaan is a calm entry surface: the Work Order form lives in a focused
 * dialog so the page itself only says where a Work Order starts and what
 * comes next (Antrean).
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

      <section className="mt-6 flex flex-col gap-4 rounded-xl border border-(--color-border) bg-(--color-surface) p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--color-brand)/10 text-(--color-brand)">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-(--color-text)">{copy('New Work Order')}</p>
            <p className="text-sm text-(--color-text-muted)">
              {copy('Customer, vehicle, and complaint.')}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canOpenQueue ? (
            <DButton variant="secondary" className="w-full sm:w-auto" onClick={openQueue}>
              {copy('View queue')}
            </DButton>
          ) : null}
          <DButton
            className="w-full sm:w-auto"
            disabled={!selectedLocationId}
            onClick={() => setDialogOpen(true)}
          >
            {copy('Create Work Order')}
          </DButton>
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
