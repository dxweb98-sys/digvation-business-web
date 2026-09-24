import { useOptionalAuth } from '@digvation/business-auth';
import { formatMoney as formatSharedMoney } from '@digvation/business-money';
import {
  createBusinessDateTimeFormatter,
  useDeploymentBootstrap,
} from '@digvation/business-runtime';

import {
  operationalCopy,
  operationalLabel,
  resolveOperationalLocale,
  type OperationalLocale,
} from './operational-localization-base';

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
      formatSharedMoney(amount, currency, locale),
  };
}
