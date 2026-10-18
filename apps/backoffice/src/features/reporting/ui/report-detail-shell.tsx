import { DButton, DDialog } from '@digvation/ui';
import type { ReactNode } from 'react';

import { RecordDialogTitle } from '../../../shared/ui/record-dialog';
import { useReportingLocalization } from '../localization/use-reporting-localization';

/** The shared read-only shell: brand-dot title with identity and state, cards, and Close. */
/**
 * A record whose identity the Runtime did not provide cannot be read in detail; say so plainly
 * instead of waiting on a request that can never be made.
 */
export function UnavailableDetail({
  open,
  onClose,
  title,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
}) {
  const { copy } = useReportingLocalization();
  return (
    <DetailShell open={open} onClose={onClose} title={title}>
      <p className="py-6 text-center text-sm text-[var(--color-text-muted)]" role="status">
        {copy('This record’s detail is not available. Refresh the report and try again.')}
      </p>
    </DetailShell>
  );
}

export function DetailShell({
  open,
  onClose,
  title,
  badge,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const { copy } = useReportingLocalization();
  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="lg"
      ariaLabel={title}
      title={<RecordDialogTitle title={title}>{badge}</RecordDialogTitle>}
      footer={
        <div className="flex justify-end">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-4">{children}</div>
    </DDialog>
  );
}
