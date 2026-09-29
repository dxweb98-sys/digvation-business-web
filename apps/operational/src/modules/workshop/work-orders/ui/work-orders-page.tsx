import { DAlert, DButton, DDataTable, DTabs, DTabsList, DTabsTrigger } from '@digvation/ui';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { WorkshopWorkOrderStatus } from '../api/workshop-queue-api';
import {
  useWorkOrderWorkspace,
  WORK_ORDER_STATUS_FILTERS,
} from '../model/use-work-order-workspace';
import { CreateWorkOrderDialog } from './create/create-work-order-dialog';
import { MechanicPickerDialog } from './mechanic-picker-dialog';
import { buildWorkOrderColumns } from './work-order-columns';
import { WorkOrderDetailDialog } from './work-order-detail-dialog';

/**
 * The single Work Order workspace: create, list, filter by lifecycle status,
 * open a Work Order and run its lifecycle actions. There is no separate
 * intake or queue page; the status filter is the queue view.
 */
export function WorkOrdersPage() {
  const { copy, label, formatDate } = useOperationalLocalization();
  const workspace = useWorkOrderWorkspace();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const { workOrders, pageSize, offset } = workspace;

  const columns = useMemo(
    () => buildWorkOrderColumns({ copy, label, formatDate }),
    [copy, label, formatDate],
  );

  return (
    <div className="p-5 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
            {copy('Operations')}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-(--color-text)">
            {copy('Work Order')}
          </h1>
          <p className="mt-1.5 text-sm text-(--color-text-muted)">
            {copy('Track workshop jobs from vehicle arrival to completion.')}
          </p>
        </div>

        {workspace.canCreate ? (
          <DButton
            className="w-full sm:w-auto"
            disabled={!workspace.selectedLocationId}
            onClick={() => setCreateOpen(true)}
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="size-4" aria-hidden="true" />
              {copy('Create Work Order')}
            </span>
          </DButton>
        ) : null}
      </header>

      {!workspace.selectedLocationId ? (
        <DAlert variant="warning" className="mt-5" title={copy('Select a Location to continue.')} />
      ) : null}

      {workspace.canRead ? (
        <section className="mt-6 space-y-3">
          <DTabs
            value={workspace.statusFilter}
            defaultValue=""
            onValueChange={(value) =>
              workspace.changeStatusFilter(value as WorkshopWorkOrderStatus | '')
            }
          >
            <div className="overflow-x-auto pb-1">
              <DTabsList className="flex w-max min-w-0 gap-0.5" aria-label={copy('Status')}>
                {WORK_ORDER_STATUS_FILTERS.map((status) => (
                  <DTabsTrigger
                    key={status || 'ALL'}
                    value={status}
                    className="whitespace-nowrap px-3 py-1.5 text-[13px]"
                  >
                    {status ? label(status) : copy('All')}
                  </DTabsTrigger>
                ))}
              </DTabsList>
            </div>
          </DTabs>

          {workOrders.isError && !workOrders.data ? (
            <div>
              <DAlert variant="danger" title={copy('Could not load the Workshop queue.')} />
              <DButton
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => void workOrders.refetch()}
              >
                {copy('Retry')}
              </DButton>
            </div>
          ) : (
            <DDataTable
              columns={columns}
              data={workOrders.data?.items ?? []}
              loading={workOrders.isLoading || !workspace.selectedLocationId}
              rowKey="id"
              onRowClick={workspace.openDetail}
              searchable
              searchPlaceholder={copy('Search Work Orders, customers, or vehicles')}
              searchValue={workspace.query}
              onSearchChange={workspace.changeQuery}
              pagination={{
                page: Math.floor(offset / pageSize) + 1,
                pageSize,
                total: workOrders.data?.total ?? 0,
              }}
              onPageChange={workspace.changePage}
              onPageSizeChange={workspace.changePageSize}
              emptyMessage={
                workspace.query.trim() || workspace.statusFilter
                  ? copy('No Work Orders match the current filters.')
                  : copy('No Work Orders at this branch yet.')
              }
            />
          )}
        </section>
      ) : null}

      <WorkOrderDetailDialog
        workOrder={workspace.selected}
        permissions={workspace.permissions}
        isCancelling={workspace.isCancelling}
        cancelReason={workspace.cancelReason}
        cancelPending={workspace.cancelPending}
        commandPending={workspace.commandPending}
        onClose={workspace.closeDetail}
        onAction={workspace.runAction}
        onOpenMechanicPicker={workspace.openPicker}
        onCancelReasonChange={workspace.setCancelReason}
        onCancelBack={() => {
          workspace.setCancelling(false);
          workspace.setCancelReason('');
        }}
        onCancelConfirm={workspace.confirmCancel}
      />

      <MechanicPickerDialog
        open={workspace.pickerOpen && Boolean(workspace.selected)}
        mode={workspace.selected?.mechanic ? 'replace' : 'assign'}
        currentEmployeeId={workspace.selected?.mechanic?.employeeId ?? null}
        mechanics={workspace.mechanics.data?.items}
        loading={workspace.mechanics.isLoading}
        failed={workspace.mechanics.isError}
        pending={workspace.assignPending}
        onRetry={() => void workspace.mechanics.refetch()}
        onClose={workspace.closePicker}
        onConfirm={workspace.assignMechanic}
      />

      {workspace.canCreate ? (
        <CreateWorkOrderDialog open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      ) : null}
    </div>
  );
}
