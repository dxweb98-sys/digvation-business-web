import { formatMoney as formatSharedMoney } from '@digvation/business-money';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { backofficeCopy } from './backoffice-localization-copy';
import { backofficeMessages } from './backoffice-localization-messages';

export type BackofficeLocale = 'id' | 'en';

const storageKey = 'digvation.pos.backoffice.locale.v1';

export type BackofficeMessageKey = keyof (typeof backofficeMessages)['id'];

interface BackofficeLocalizationValue {
  locale: BackofficeLocale;
  setLocale: (locale: BackofficeLocale) => void;
  t: (key: BackofficeMessageKey) => string;
  copy: (value: string) => string;
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatMoney: (amount: string, currency: string) => string;
}

const BackofficeLocalizationContext = createContext<BackofficeLocalizationValue | null>(null);

export function readStoredBackofficeLocale(): BackofficeLocale {
  if (typeof window === 'undefined') return 'id';
  return window.localStorage.getItem(storageKey) === 'en' ? 'en' : 'id';
}

export function BackofficeLocalizationProvider({ children }: { children: ReactNode }) {
  const [locale, setCurrentLocale] = useState<BackofficeLocale>(readStoredBackofficeLocale);
  const setLocale = useCallback((nextLocale: BackofficeLocale) => {
    window.localStorage.setItem(storageKey, nextLocale);
    setCurrentLocale(nextLocale);
  }, []);
  const value = useMemo<BackofficeLocalizationValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => backofficeMessages[locale][key],
      copy: (value) => backofficeCopy[value]?.[locale] ?? value,
      formatDate: (value, options) =>
        new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', options).format(value),
      formatMoney: (amount, currency) =>
        formatSharedMoney(amount, currency, locale === 'id' ? 'id-ID' : 'en-US'),
    }),
    [locale, setLocale],
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
