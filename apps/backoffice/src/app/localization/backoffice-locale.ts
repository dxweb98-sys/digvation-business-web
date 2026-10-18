export type ConfiguredBackofficeLocale = 'id' | 'en';

export function resolveBackofficeLocale(locale: string | undefined): ConfiguredBackofficeLocale {
  return locale === 'en-US' ? 'en' : 'id';
}
