import {
  ApplicationSplash,
  useDeploymentBootstrap,
} from '@digvation/business-runtime';
import { useBackofficeLocalization } from '../app/localization/backoffice-localization';

export function AuthenticationLoading() {
  const bootstrap = useDeploymentBootstrap();
  const { locale } = useBackofficeLocalization();

  return (
    <ApplicationSplash
      productName={bootstrap.branding.productName}
      message={locale === 'id' ? 'Menyiapkan Backoffice' : 'Preparing Backoffice'}
      mark={
        bootstrap.branding.logoUrl ? (
          <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-white p-1">
            <img
              src={bootstrap.branding.logoUrl}
              alt=""
              className="size-full object-contain"
            />
          </span>
        ) : (
          <span className="flex h-5 items-end gap-1">
            <span className="h-3 w-1.5 rounded-full bg-current" />
            <span className="h-5 w-1.5 rounded-full bg-current" />
            <span className="h-4 w-1.5 rounded-full bg-current" />
          </span>
        )
      }
    />
  );
}
