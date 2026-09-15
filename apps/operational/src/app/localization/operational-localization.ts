import {
  createBusinessDateTimeFormatter,
  useRuntime,
} from '@digvation/business-runtime';

import {
  operationalCopy,
  operationalLabel,
  resolveOperationalLocale,
  type OperationalLocale,
} from './operational-localization.legacy';

export {
  operationalCopy,
  operationalLabel,
  resolveOperationalLocale,
};
export type { OperationalLocale };

export function useOperationalLocalization() {
  const runtime = useRuntime();
  const dateTime = createBusinessDateTimeFormatter(runtime);
  const locale: OperationalLocale = resolveOperationalLocale(dateTime.locale);

  return {
    locale,
    copy: (value: string) => operationalCopy(value, locale),
    label: (value: string) => operationalLabel(value, locale),
    formatDate: dateTime.format,
    formatTime: dateTime.formatTime,
    formatDateTime: dateTime.formatDateTime,
    formatDateOnly: dateTime.formatDateOnly,
    businessTimezone: dateTime.timezone,
    formatMoney: (amount: string, currency: string) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(Number(amount)),
  };
}
