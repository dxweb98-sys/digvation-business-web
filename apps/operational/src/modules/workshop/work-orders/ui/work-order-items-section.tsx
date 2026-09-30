import { formatMoney } from '@digvation/business-money';
import { DAlert, DButton, DSkeleton } from '@digvation/ui';
import { ListPlus, Pencil, Plus, Wrench } from 'lucide-react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { WorkshopWorkOrderDetail, WorkshopWorkOrderLine } from '../api/workshop-lines-api';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { useWorkOrderItems } from '../model/use-work-order-items';
import {
  canAdjustItems,
  canSelectInitialItems,
  formatQuantity,
} from '../model/work-order-lines-model';
import { AdjustItemsDialog } from './adjust-items-dialog';
import { ITEM_DETAIL, ITEM_META, ITEM_NAME, ITEM_VALUE } from './item-anatomy';
import { ItemTypeMarker } from './item-type-marker';
import { InitialItemsDialog } from './initial-items-dialog';
import { CountPill, SectionHeader, SectionMark, SURFACE_RAISED } from './section-identity';
import { WorkOrderItemHistory } from './work-order-item-history';

/** One accepted item, rendered strictly from the snapshot Runtime returned. */
function AcceptedLine({ line }: { line: WorkshopWorkOrderLine }) {
  const { copy, locale } = useOperationalLocalization();
  const money = (amount: string) => formatMoney(amount, line.currency, locale, 0);
  const includes = line.components.map((component) =>
    component.variantName ? `${component.itemName} (${component.variantName})` : component.itemName,
  );

  return (
    <li className="px-4 py-4">
      <div className="flex items-start gap-3">
        <ItemTypeMarker type={line.itemType} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className={ITEM_NAME}>
              {line.itemName}
              {line.variantName ? (
                <span className="font-normal text-(--color-text-muted)"> - {line.variantName}</span>
              ) : null}
            </p>
            <p className={`shrink-0 text-[15px] ${ITEM_VALUE}`}>{money(line.lineAmount)}</p>
          </div>
          <p className={`mt-0.5 ${ITEM_META}`}>
            {line.itemType === 'SERVICE' ? copy('Service') : copy('Spare part')}
          </p>
          <p className={`${ITEM_META} tabular-nums`}>
            {formatQuantity(line.quantity)} × {money(line.unitPrice)}
          </p>
          {includes.length ? (
            <p
              className={`mt-2 line-clamp-3 break-words rounded-lg bg-(--color-surface-muted)/70 px-2.5 py-1.5 ${ITEM_DETAIL}`}
            >
              {copy('Includes')}: {includes.join(', ')}
            </p>
          ) : null}
        </div>
      </div>
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
    <>
      <section
        aria-label={copy('Work Order items')}
        className={`overflow-hidden rounded-2xl ${SURFACE_RAISED} lg:flex lg:min-h-0 lg:flex-1 lg:flex-col`}
      >
        <SectionHeader
          icon={Wrench}
          tone="work"
          title={copy('Work Order items')}
          className="border-b border-(--color-border) bg-(--color-brand)/[0.05]"
          meta={
            lines && lines.length > 0 ? (
              <CountPill>
                {lines.length} {copy('items')}
              </CountPill>
            ) : null
          }
          actions={
            canAdjust && lines.length > 0 ? (
              <>
                <DButton
                  variant="secondary"
                  size="sm"
                  onClick={() => items.openAdjust({ addFirst: true })}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Plus className="size-4" aria-hidden="true" />
                    <span className="max-sm:sr-only">{copy('Add item')}</span>
                  </span>
                </DButton>
                <DButton variant="secondary" size="sm" onClick={() => items.openAdjust()}>
                  <span className="inline-flex items-center gap-1.5">
                    <Pencil className="size-4" aria-hidden="true" />
                    <span className="max-sm:sr-only">{copy('Change items')}</span>
                  </span>
                </DButton>
              </>
            ) : null
          }
        />

        {items.detail.isError && !lines ? (
          <div className="px-4 py-4">
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
          <div aria-busy="true" className="space-y-3 px-4 py-4">
            <DSkeleton className="h-12 w-full" />
            <DSkeleton className="h-12 w-full" />
          </div>
        ) : lines.length > 0 ? (
          <ul className="divide-y divide-(--color-border) lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {lines.map((line) => (
              <AcceptedLine key={line.id} line={line} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center lg:min-h-0 lg:flex-1">
            <span className="relative mb-3">
              <SectionMark icon={Wrench} tone="work" size="lg" />
              <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-(--color-surface) text-(--color-brand) shadow-sm ring-1 ring-black/[0.08]">
                <Plus className="size-3.5" aria-hidden="true" />
              </span>
            </span>
            <p className="text-base font-semibold text-(--color-text)">
              {copy('No work items yet')}
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-(--color-text-muted)">
              {canSelect || canAdjust
                ? copy('Add the services and spare parts worked on for this Work Order.')
                : copy('No items selected yet.')}
            </p>
            {canSelect ? (
              <DButton className="mt-4" variant="primary" onClick={items.openPicker}>
                <span className="inline-flex items-center gap-1.5">
                  <ListPlus className="size-4" aria-hidden="true" />
                  {copy('Select items')}
                </span>
              </DButton>
            ) : canAdjust ? (
              <DButton
                className="mt-4"
                variant="primary"
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

        {lines !== undefined && (lines.length > 0 || adjustments.length > 0) ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-(--color-border) bg-(--color-surface-muted)/40 px-4 py-2">
            {lines.length > 0 ? (
              <p className="text-[12px] text-(--color-text-muted)">
                {copy('Prices are recorded when items are saved.')}
              </p>
            ) : (
              <span />
            )}
            <WorkOrderItemHistory entries={adjustments} />
          </footer>
        ) : null}
      </section>

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
    </>
  );
}
