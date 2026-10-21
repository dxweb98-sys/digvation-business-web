import { useRuntime } from '@digvation/business-runtime';
import { useMemo } from 'react';

import { useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import { TransactionDetailDialog, TransactionHistoryApi } from '../../transaction-history';
import type { ReportRow } from '../api/reporting-api';
import { useReportingLocalization } from '../localization/use-reporting-localization';
import { UnavailableDetail } from './report-detail-shell';

/** The authoritative Transaction History detail, opened read-only from a report. */
export function ReportTransactionDetail({
  row,
  open,
  onClose,
}: {
  row: ReportRow;
  open: boolean;
  onClose: () => void;
}) {
  const { createApiClient } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const { copy } = useReportingLocalization();
  const api = useMemo(
    () => new TransactionHistoryApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  if (!row.saleId)
    return <UnavailableDetail open={open} onClose={onClose} title={copy('Transaction detail')} />;
  return (
    <TransactionDetailDialog
      open={open}
      saleId={row.saleId ? String(row.saleId) : null}
      api={api}
      permissions={{ refund: false, reverse: false }}
      onClose={onClose}
      onChanged={() => undefined}
    />
  );
}
