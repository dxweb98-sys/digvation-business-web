import { useCallback } from 'react';

import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { businessCopy } from './business-copy';

export function useBusinessLocalization() {
  const { locale, copy: globalCopy, formatDate } = useBackofficeLocalization();
  const copy = useCallback(
    (value: string) => businessCopy[value]?.[locale] ?? globalCopy(value),
    [globalCopy, locale],
  );
  return { locale, copy, formatDate };
}
