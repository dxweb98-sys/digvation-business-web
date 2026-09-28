import { DBadge, type TableColumn } from '@digvation/ui';

import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { formatPhoneForDisplay } from '../../shared/model/format-phone';
import { STATUS_BADGE_VARIANT } from '../model/workshop-status-presentation';

interface ColumnHelpers {
  copy: (value: string) => string;
  label: (value: string) => string;
  formatDate: (date: Date, options: Intl.DateTimeFormatOptions) => string;
}

/**
 * The one Work Order table: identity first, then lifecycle status, then who
 * and what is being worked on. Only fields the Work Order list contract
 * returns are shown.
 */
export function buildWorkOrderColumns({
  copy,
  label,
  formatDate,
}: ColumnHelpers): TableColumn<WorkshopQueueWorkOrder>[] {
  return [
    {
      key: 'workOrderNumber',
      label: copy('Work Order'),
      render: (row) => (
        <span className="whitespace-nowrap font-semibold text-(--color-text)">
          {row.workOrderNumber}
        </span>
      ),
    },
    {
      key: 'workStatus',
      label: copy('Status'),
      render: (row) => (
        <DBadge variant={STATUS_BADGE_VARIANT[row.workStatus]}>{label(row.workStatus)}</DBadge>
      ),
    },
    {
      key: 'customerNameSnapshot',
      label: copy('Customer'),
      render: (row) => (
        <div className="min-w-36">
          <p className="whitespace-nowrap font-medium text-(--color-text)">
            {row.customerNameSnapshot}
          </p>
          <p className="mt-0.5 whitespace-nowrap text-xs text-(--color-text-muted)">
            {formatPhoneForDisplay(row.customerPhoneSnapshot)}
          </p>
        </div>
      ),
    },
    {
      key: 'vehiclePlateSnapshot',
      label: copy('Vehicle'),
      render: (row) => (
        <div className="min-w-28">
          <p className="font-bold tracking-wide text-(--color-text)">{row.vehiclePlateSnapshot}</p>
          <p className="mt-0.5 max-w-40 truncate text-xs text-(--color-text-muted)">
            {row.vehicleChassisNumberSnapshot}
          </p>
        </div>
      ),
    },
    {
      key: 'customerRequest',
      label: copy('Keluhan'),
      render: (row) => (
        <span className="line-clamp-2 min-w-44 text-sm text-(--color-text-muted)">
          {row.customerRequest}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: copy('Created'),
      render: (row) => (
        <span className="whitespace-nowrap text-sm text-(--color-text-muted)">
          {formatDate(new Date(row.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      ),
    },
  ];
}
