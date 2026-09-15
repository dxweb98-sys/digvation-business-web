import { useAuth } from '@digvation/business-auth';
import { useRuntime } from '@digvation/business-runtime';

import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { getAppVersion } from '../../app/version/app-version';

export function AccountPage() {
  const { session } = useAuth();
  const runtime = useRuntime();
  const { copy } = useOperationalLocalization();
  const version = getAppVersion();
  const businessName =
    runtime.branding.businessName ?? runtime.branding.companyName ?? runtime.branding.productName;

  return (
    <section className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em]">{copy('Account')}</h1>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            [copy('Name'), session.identity.displayName],
            [copy('Email'), session.identity.email ?? copy('Not available')],
            [copy('Business'), businessName],
            [copy('Version'), version.version],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-[var(--color-border)] bg-white p-5"
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                {label}
              </dt>
              <dd className="mt-2 break-all text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
