import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

export function TaxPage() {
  const { t } = useBackofficeLocalization();
  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={t('configuration')}
        title={t('tax')}
        description={t('taxDescription')}
      />
    </BackofficePage>
  );
}
