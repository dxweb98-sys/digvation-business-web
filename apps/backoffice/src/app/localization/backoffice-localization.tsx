import { useMemo } from 'react';
import {
  createBusinessDateTimeFormatter,
  useRuntime,
} from '@digvation/business-runtime';

import {
  BackofficeLocalizationProvider,
  readStoredBackofficeLocale,
  useBackofficeLocalization as useLegacyBackofficeLocalization,
} from './backoffice-localization-core';

export { BackofficeLocalizationProvider, readStoredBackofficeLocale };
export type {
  BackofficeLocale,
  BackofficeMessageKey,
} from './backoffice-localization-core';

export function useBackofficeLocalization() {
  const localization = useLegacyBackofficeLocalization();
  const runtime = useRuntime();
  const dateTime = useMemo(
    () => createBusinessDateTimeFormatter(runtime),
    [runtime.businessConfiguration, runtime.locale],
  );

  return useMemo(
    () => ({
      ...localization,
      formatDate: dateTime.format,
      formatTime: dateTime.formatTime,
      formatDateTime: dateTime.formatDateTime,
      formatDateOnly: dateTime.formatDateOnly,
      businessTimezone: dateTime.timezone,
    }),
    [dateTime, localization],
  );
}
