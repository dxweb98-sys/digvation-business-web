import { useOptionalAuth } from '@digvation/business-auth';
import {
  createBusinessDateTimeFormatter,
  useDeploymentBootstrap,
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
  const bootstrap = useDeploymentBootstrap();
  const auth = useOptionalAuth();
  const dateTime = createBusinessDateTimeFormatter(
    auth?.session.preferences ?? {
      locale: bootstrap.defaults.locale,
      timezone: 'UTC',
    },
  );
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
