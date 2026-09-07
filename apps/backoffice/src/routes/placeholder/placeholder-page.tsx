import { DEmptyState } from '@digvation/ui';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { type BackofficeMessageKey, useBackofficeLocalization } from '../../app/localization/backoffice-localization';

export function PlaceholderPage({ title }: { title: BackofficeMessageKey }) {
  const { t } = useBackofficeLocalization();
  return <BackofficePage><BackofficePageHeader title={t(title)} /><DEmptyState className="mt-6" title={t('notAvailableYet')} description={t('notAvailableDescription')} /></BackofficePage>;
}
