import { formatMoney } from '@digvation/business-money';
import { DAlert, DBadge, DButton, DSkeleton } from '@digvation/ui';
import { ListPlus, Pencil, Plus } from 'lucide-react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type {
  WorkshopWorkOrderDetail,
  WorkshopWorkOrderLine,
} from '../api/workshop-lines-api';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { IconActionButton } from '../../shared/ui/icon-action-button';
import { useWorkOrderItems } from '../model/use-work-order-items';
import {
  canAdjustItems,
  canSelectInitialItems,
  formatQuantity,
} from '../model/work-order-lines-model';
import { AdjustItemsDialog } from './adjust-items-dialog';
import { InitialItemsDialog } from './initial-items-dialog';
import { WorkOrderItemHistory } from './work-order-item-history';

/** One accepted item, rendered strictly from the snapshot Runtime returned. */
function AcceptedLine({ line }: { line: WorkshopWorkOrderLine }) {
  const { copy, locale } = useOperationalLocalization();
  const money = (amount: string) => formatMoney(amount, line.currency, locale, 0);
  const includes = line.components.map((component) =>
    component.variantName ? `${component.itemName} (${component.variantName})` : component.itemName,
  );

  return (
    <li className="px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-(--color-text)">
            {line.itemName}
            {line.variantName ? (
              <span className="font-normal text-(--color-text-muted)"> - {line.variantName}</span>
            ) : null}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-(--color-text-muted)">
            <DBadge variant="outline">
              {line.itemType === 'SERVICE' ? copy('Service') : copy('Spare part')}
            </DBadge>
            <span className="tabular-nums">
              {formatQuantity(line.quantity)} x {money(line.unitPrice)}
            </span>
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-(--color-text)">
          {money(line.lineAmount)}
        </p>
      </div>
      {includes.length ? (
        <p className="mt-1.5 text-[13px] leading-snug text-(--color-text-muted)">
          {copy('Includes')}: {includes.join(', ')}
        </p>
      ) : null}
    </li>
  );
}

/**
 * The effective items of one Work Order: the one-time initial selection, and
 * (while the Work Order is open) adding, changing and removing items through
 * one staged dialog. Every value shown comes from Runtime.
 */
export function WorkOrderItemsSection({
  workOrder,
  permissions,
  onAccepted,
  onStale,
}: {
  workOrder: WorkshopQueueWorkOrder;
  permissions: readonly string[];
  onAccepted: (workOrder: WorkshopWorkOrderDetail) => void;
  onStale: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const items = useWorkOrderItems({ workOrder, onAccepted, onStale });
  const lines = items.detail.data?.lines;
  const adjustments = items.detail.data?.adjustments ?? [];
  // Removed Lines still count: Runtime accepts the initial set only once.
  const canSelect =
    lines !== undefined &&
    canSelectInitialItems(workOrder.workStatus, permissions, lines.length + adjustments.length);
  const canAdjust = lines !== undefined && canAdjustItems(workOrder.workStatus, permissions);

  return (
    <section aria-label={copy('Work Order items')} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold text-(--color-text-muted)">
          {copy('Work Order items')}
        </h3>
        {canAdjust && lines.length > 0 ? (
          <div className="flex items-center gap-1">
            <IconActionButton
              icon={Plus}
              touch
              label={copy('Add item')}
              onClick={() => items.openAdjust({ addFirst: true })}
            />
            <IconActionButton
              icon={Pencil}
              touch
              label={copy('Change items')}
              onClick={() => items.openAdjust()}
            />
          </div>
        ) : null}
      </div>

      {items.detail.isError && !lines ? (
        <div>
          <DAlert variant="danger" title={copy('Could not load Work Order items.')} />
          <DButton
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void items.detail.refetch()}
          >
            {copy('Retry')}
          </DButton>
        </div>
      ) : !lines ? (
        <div aria-busy="true" className="space-y-2">
          <DSkeleton className="h-14 w-full" />
        </div>
      ) : lines.length > 0 ? (
        <>
          <ul className="divide-y divide-(--color-border) rounded-lg border border-(--color-border)">
            {lines.map((line) => (
              <AcceptedLine key={line.id} line={line} />
            ))}
          </ul>
          <p className="text-[12px] text-(--color-text-muted)">
            {copy('Prices are recorded when items are saved.')}
          </p>
          <WorkOrderItemHistory entries={adjustments} />
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-(--color-border) px-3.5 py-3">
          <p className="text-sm text-(--color-text-muted)">{copy('No items selected yet.')}</p>
          {canSelect ? (
            <DButton variant="secondary" size="sm" onClick={items.openPicker}>
              <span className="inline-flex items-center gap-1.5">
                <ListPlus className="size-4" aria-hidden="true" />
                {copy('Select items')}
              </span>
            </DButton>
          ) : canAdjust ? (
            <DButton
              variant="secondary"
              size="sm"
              onClick={() => items.openAdjust({ addFirst: true })}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="size-4" aria-hidden="true" />
                {copy('Add item')}
              </span>
            </DButton>
          ) : null}
        </div>
      )}

      {lines !== undefined && adjustments.length > 0 && lines.length === 0 ? (
        <WorkOrderItemHistory entries={adjustments} />
      ) : null}

      {canAdjust ? (
        <AdjustItemsDialog
          open={items.adjustOpen && !items.pickerOpen}
          lines={lines}
          draft={items.draft}
          pending={items.adjustPending}
          onChange={items.changeDraft}
          onAddItem={items.openPicker}
          onClose={items.closeAdjust}
          onSave={() => items.saveAdjustment(lines)}
        />
      ) : null}

      {canSelect || canAdjust ? (
        <InitialItemsDialog
          mode={items.adjustOpen ? 'add' : 'initial'}
          open={items.pickerOpen}
          items={items.catalog.data?.items}
          loading={items.catalog.isLoading}
          failed={items.catalog.isError}
          candidates={items.candidates.data?.items}
          candidatesLoading={items.candidates.isLoading}
          candidatesFailed={items.candidates.isError}
          pending={items.acceptPending}
          onWantCandidates={items.wantCandidates}
          onRetry={() => void items.catalog.refetch()}
          onClose={items.closePicker}
          onConfirm={(selection, drafts) =>
            items.adjustOpen ? items.stageAdded(drafts) : items.accept(selection)
          }
        />
      ) : null}
    </section>
  );
}
