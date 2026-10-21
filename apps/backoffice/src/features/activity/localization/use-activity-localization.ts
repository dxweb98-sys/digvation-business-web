import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';

import { activityCopy } from './activity-copy';

export function useActivityLocalization() {
  const base = useBackofficeLocalization();
  return { ...base, text: activityCopy[base.locale] };
}
