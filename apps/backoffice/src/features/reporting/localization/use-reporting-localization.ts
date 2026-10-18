import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import type { ReportFormatContext } from '../model/report-format';

import { reportingCopy } from './reporting-copy';

export function useReportingLocalization() {
  const base = useBackofficeLocalization();
  const copy = (value: string) => reportingCopy[value]?.[base.locale] ?? base.copy(value);
  const format: ReportFormatContext = {
    copy,
    numberLocale: base.locale === 'id' ? 'id-ID' : 'en-US',
    formatMoney: base.formatMoney,
    formatDate: base.formatDate,
    currency: 'IDR',
  };

  return { ...base, copy, format };
}
