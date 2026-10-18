import { useAuth } from '@digvation/business-auth';
import { DCard } from '@digvation/ui';

import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { getAppVersion } from '../../app/version/app-version';

export function AccountPage() {
  const { session } = useAuth();
  const version = getAppVersion();
  const { locale, t } = useBackofficeLocalization();

  return (
    <BackofficePage>
      <BackofficePageHeader title={t('userAccount')} />
      <DCard className="mt-6 p-6">
        <p className="text-sm font-semibold text-[var(--color-text)]">
          {session.identity.displayName}
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          {locale === 'id' ? 'Versi' : 'Version'} {version.version}
        </p>
      </DCard>
    </BackofficePage>
  );
}
