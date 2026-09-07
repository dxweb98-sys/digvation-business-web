import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

export function DashboardPage() {
  const { t } = useBackofficeLocalization();
  return <BackofficePage><BackofficePageHeader eyebrow={t('overview')} title={t('dashboard')} description={t('workspaceReady')} /></BackofficePage>;
}
