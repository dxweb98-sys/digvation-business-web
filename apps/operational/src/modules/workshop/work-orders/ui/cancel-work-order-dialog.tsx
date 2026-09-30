import { DButton, DDialog, DTextarea } from '@digvation/ui';
import { TriangleAlert } from 'lucide-react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { SectionMark } from './section-identity';

/**
 * Focused confirmation for cancelling a Work Order. Cancellation is a
 * destructive command, so it lives in its own compact dialog instead of
 * turning the Work Order detail into a form: the detail stays exactly as it
 * is behind it. State and the mutation stay with the workspace; this is
 * presentation only.
 */
export function CancelWorkOrderDialog({
  open,
  workOrderNumber,
  reason,
  pending,
  onReasonChange,
  onBack,
  onConfirm,
}: {
  open: boolean;
  workOrderNumber: string;
  reason: string;
  pending: boolean;
  onReasonChange: (value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const title = copy('Cancel work order');

  return (
    <DDialog
      open={open}
      onClose={onBack}
      size="sm"
      ariaLabel={title}
      title={
        <span className="flex items-center gap-3">
          <SectionMark icon={TriangleAlert} tone="danger" />
          <span className="text-lg font-bold tracking-tight">{title}</span>
        </span>
      }
      description={
        <span>
          Work Order <span className="font-semibold text-(--color-text)">{workOrderNumber}</span>{' '}
          {copy('will be cancelled.')}
        </span>
      }
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="outline" onClick={onBack} disabled={pending}>
            {copy('Back')}
          </DButton>
          <DButton variant="danger" loading={pending} disabled={!reason.trim()} onClick={onConfirm}>
            {copy('Yes, cancel')}
          </DButton>
        </div>
      }
    >
      <DTextarea
        label={copy('Cancellation reason')}
        hint={copy('The reason is recorded on the Work Order.')}
        value={reason}
        onChange={onReasonChange}
        placeholder={copy('For example, the customer changed their mind.')}
        clearable={false}
      />
    </DDialog>
  );
}
