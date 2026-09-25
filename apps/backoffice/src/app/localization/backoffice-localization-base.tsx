import { formatMoney as formatSharedMoney } from '@digvation/business-money';
import {
  createBusinessDateTimeFormatter,
  type BusinessDateTimePreferences,
  type BusinessDateTimeValue,
} from '@digvation/business-runtime';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { backofficeCopy } from './backoffice-localization-copy';
import { backofficeMessages } from './backoffice-localization-messages';

export type BackofficeLocale = 'id' | 'en';

const storageKey = 'digvation.pos.backoffice.locale.v1';

export type BackofficeMessageKey = keyof (typeof backofficeMessages)['id'];

interface BackofficeLocalizationValue {
  locale: BackofficeLocale;
  setLocale: (locale: BackofficeLocale) => void;
  setBusinessDateTimePreferences: (preferences: BusinessDateTimePreferences) => void;
  t: (key: BackofficeMessageKey) => string;
  copy: (value: string) => string;
  formatDate: (value: BusinessDateTimeValue, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: BusinessDateTimeValue) => string;
  formatDateTime: (value: BusinessDateTimeValue) => string;
  formatDateOnly: (value: string) => string;
  formatMoney: (amount: string, currency: string) => string;
}

const BackofficeLocalizationContext = createContext<BackofficeLocalizationValue | null>(null);

export function readStoredBackofficeLocale(): BackofficeLocale {
  if (typeof window === 'undefined') return 'id';
  return window.localStorage.getItem(storageKey) === 'en' ? 'en' : 'id';
}

export function BackofficeLocalizationProvider({ children }: { children: ReactNode }) {
  const [locale, setCurrentLocale] = useState<BackofficeLocale>(readStoredBackofficeLocale);
  const [businessDateTimePreferences, setBusinessDateTimePreferences] =
    useState<BusinessDateTimePreferences>({
      locale: 'id-ID',
      timezone: 'UTC',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm',
    });
  const setLocale = useCallback((nextLocale: BackofficeLocale) => {
    window.localStorage.setItem(storageKey, nextLocale);
    setCurrentLocale(nextLocale);
  }, []);
  const dateTime = useMemo(
    () =>
      createBusinessDateTimeFormatter({
        ...businessDateTimePreferences,
        locale: locale === 'id' ? 'id-ID' : 'en-US',
      }),
    [businessDateTimePreferences, locale],
  );
  const value = useMemo<BackofficeLocalizationValue>(
    () => ({
      locale,
      setLocale,
      setBusinessDateTimePreferences,
      t: (key) => backofficeMessages[locale][key],
      copy: (value) => backofficeCopy[value]?.[locale] ?? value,
      formatDate: dateTime.format,
      formatTime: dateTime.formatTime,
      formatDateTime: dateTime.formatDateTime,
      formatDateOnly: dateTime.formatDateOnly,
      formatMoney: (amount, currency) =>
        formatSharedMoney(amount, currency, locale === 'id' ? 'id-ID' : 'en-US'),
    }),
    [dateTime, locale, setLocale],
  );
  return (
    <BackofficeLocalizationContext.Provider value={value}>
      {children}
    </BackofficeLocalizationContext.Provider>
  );
}

export function useBackofficeLocalization(): BackofficeLocalizationValue {
  const context = useContext(BackofficeLocalizationContext);
  if (!context) throw new Error('BackofficeLocalizationProvider is missing.');
  return context;
}
