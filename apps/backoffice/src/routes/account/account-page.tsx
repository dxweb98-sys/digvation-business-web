import { useAuth } from '@digvation/business-auth';
import { useRuntime } from '@digvation/business-runtime';
import { DCard } from '@digvation/ui';

import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { getAppVersion } from '../../app/version/app-version';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

export function AccountPage() {
  const { session } = useAuth();
  const runtime = useRuntime();
  const version = getAppVersion();
  const { t } = useBackofficeLocalization();

  return (
    <BackofficePage>
      <BackofficePageHeader title={t('accountAndRuntime')} />
      <DCard className="mt-6 p-6">
        <p className="mt-4 text-sm leading-7 text-[var(--color-text-muted)]">
          {session.identity.displayName} Â· {runtime.workspace} Â· {runtime.deploymentProfile}
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Version {version.version} Â· Build {version.revision}
        </p>
      </DCard>
    </BackofficePage>
  );
}
