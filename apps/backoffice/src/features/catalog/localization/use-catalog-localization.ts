import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';

import { catalogCopy } from './catalog-copy';

export function useCatalogLocalization() {
  const base = useBackofficeLocalization();

  return {
    ...base,
    copy: (value: string) => catalogCopy[value]?.[base.locale] ?? base.copy(value),
  };
}
