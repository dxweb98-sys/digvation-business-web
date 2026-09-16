import { useMemo } from 'react';
import {
  createBusinessDateTimeFormatter,
  useDeploymentBootstrap,
} from '@digvation/business-runtime';

import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import {
  BackofficeLocalizationProvider,
  readStoredBackofficeLocale,
  useBackofficeLocalization as useLegacyBackofficeLocalization,
} from './backoffice-localization.legacy';

export { BackofficeLocalizationProvider, readStoredBackofficeLocale };
export type {
  BackofficeLocale,
  BackofficeMessageKey,
} from './backoffice-localization.legacy';

export function useBackofficeLocalization() {
  const localization = useLegacyBackofficeLocalization();
  const bootstrap = useDeploymentBootstrap();
  const { session } = useBackofficeAuth();
  const dateTime = useMemo(
    () =>
      createBusinessDateTimeFormatter(
        session?.preferences ?? {
          locale: bootstrap.defaults.locale,
          timezone: 'UTC',
        },
      ),
    [bootstrap.defaults.locale, session?.contextVersion, session?.preferences],
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
