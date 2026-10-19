import { useRuntime } from '@digvation/business-runtime';
import { hasSessionFeature } from '@digvation/business-auth';
import { DTabs, DTabsContent, DTabsList, DTabsTrigger } from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { BackofficePage, BackofficePageHeader } from '../../../app/layout/backoffice-page';
import { canPerformBackofficeAction } from '../../../auth/backoffice-access';
import { useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import { ProductCommissionApi } from '../../../modules/commission/product-commission-api';
import { ProductCommissionSection } from '../../../modules/commission/product-commission-section';
import { LoyaltyApi } from '../../../modules/loyalty/loyalty-api';
import { LoyaltyConfigurationSection } from '../../../modules/loyalty/loyalty-configuration-section';
import { CatalogApi } from '../../catalog/api/catalog-api';
import { BusinessSettingsApi } from '../api/business-settings-api';
import { useBusinessLocalization } from '../localization/use-business-localization';
import { BusinessLocalizationSection } from './business-localization-section';
import { BusinessLocationsSection } from './business-locations-section';
import { BusinessNumberingSection } from './business-numbering-section';
import { BusinessProfileSection } from './business-profile-section';
import { BusinessTaxSection } from './business-tax-section';

const keys = {
  configuration: ['business-settings', 'configuration'] as const,
  locations: ['business-settings', 'locations'] as const,
  numbering: ['business-settings', 'numbering'] as const,
};

export function BusinessPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const queryClient = useQueryClient();
  const { copy } = useBusinessLocalization();
  const api = useMemo(
    () => new BusinessSettingsApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );

  const loyaltyApi = useMemo(
    () => new LoyaltyApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const commissionApi = useMemo(
    () => new ProductCommissionApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const catalogApi = useMemo(
    () => new CatalogApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const hasPosProduct = Boolean(session && hasSessionFeature(session.access, 'POS'));
  const hasTaxCapability = Boolean(session && hasSessionFeature(session.access, 'TAX_FISCAL'));
  const canViewCommission = Boolean(
    hasPosProduct &&
    session &&
    hasSessionFeature(session.access, 'POS_PRODUCT_COMMISSION') &&
    canPerformBackofficeAction(session, 'viewCommission'),
  );
  const canConfigureCommission = Boolean(
    hasPosProduct &&
    session &&
    hasSessionFeature(session.access, 'POS_PRODUCT_COMMISSION') &&
    canPerformBackofficeAction(session, 'configureCommission'),
  );
  const hasLoyaltyCapability = Boolean(
    session && hasSessionFeature(session.access, 'LOYALTY_POINTS'),
  );
  const canViewLoyalty = Boolean(
    hasLoyaltyCapability && session && canPerformBackofficeAction(session, 'viewLoyalty'),
  );
  const canConfigureLoyalty = Boolean(
    hasLoyaltyCapability && session && canPerformBackofficeAction(session, 'configureLoyalty'),
  );
  const canViewProfile = Boolean(
    session && canPerformBackofficeAction(session, 'viewBusinessProfile'),
  );
  const canUpdateProfile = Boolean(
    session && canPerformBackofficeAction(session, 'updateBusinessProfile'),
  );
  const canViewLocations = Boolean(
    session && canPerformBackofficeAction(session, 'viewSellingLocations'),
  );
  const canCreateLocation = Boolean(
    session && canPerformBackofficeAction(session, 'createSellingLocation'),
  );
  const canUpdateLocation = Boolean(
    session && canPerformBackofficeAction(session, 'updateSellingLocation'),
  );

  const configuration = useQuery({
    queryKey: keys.configuration,
    queryFn: () => api.getConfiguration(),
    enabled: canViewProfile,
  });
  const locations = useQuery({
    queryKey: keys.locations,
    queryFn: () => api.listLocations({ limit: 100, offset: 0 }),
    enabled: canViewLocations,
  });
  const numbering = useQuery({
    queryKey: keys.numbering,
    queryFn: () => api.getNumbering(),
    enabled: canViewProfile,
  });

  if (!session) return null;

  const invalidate = (queryKey: readonly string[]) =>
    void queryClient.invalidateQueries({ queryKey });
  const firstTab = canViewProfile
    ? 'profile'
    : canViewLocations
      ? 'locations'
      : canViewLoyalty
        ? 'loyalty'
        : canViewCommission
          ? 'commission'
          : 'profile';

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Configuration')}
        title={copy('Business')}
        description={copy(
          'Manage the business profile, locations, tax, numbering, and business programs.',
        )}
      />

      <DTabs defaultValue={firstTab} className="mt-6">
        {/* Six tabs outgrow a phone; the list scrolls on its own, never the page. */}
        <div className="max-w-full overflow-x-auto pb-1">
          <DTabsList>
            {canViewProfile ? <DTabsTrigger value="profile">{copy('Profile')}</DTabsTrigger> : null}
            {canViewLocations ? (
              <DTabsTrigger value="locations">{copy('Locations')}</DTabsTrigger>
            ) : null}
            {canViewProfile && hasTaxCapability ? (
              <DTabsTrigger value="tax">{copy('Tax')}</DTabsTrigger>
            ) : null}
            {canViewProfile ? (
              <DTabsTrigger value="numbering">{copy('Numbering')}</DTabsTrigger>
            ) : null}
            {canViewLoyalty ? <DTabsTrigger value="loyalty">{copy('Loyalty')}</DTabsTrigger> : null}
            {canViewCommission ? (
              <DTabsTrigger value="commission">{copy('Product commission')}</DTabsTrigger>
            ) : null}
          </DTabsList>
        </div>

        {canViewProfile ? (
          <DTabsContent value="profile" className="mt-5 space-y-5">
            <BusinessProfileSection
              profile={configuration.data?.profile}
              loading={configuration.isLoading}
              canUpdate={canUpdateProfile}
              api={api}
              onChanged={() => invalidate(keys.configuration)}
            />
            <BusinessLocalizationSection
              preferences={configuration.data?.preferences}
              loading={configuration.isLoading}
              canUpdate={canUpdateProfile}
              api={api}
              onChanged={() => invalidate(keys.configuration)}
            />
          </DTabsContent>
        ) : null}

        {canViewLocations ? (
          <DTabsContent value="locations" className="mt-5">
            <BusinessLocationsSection
              items={locations.data?.items ?? []}
              loading={locations.isLoading}
              canCreate={
                canCreateLocation &&
                (hasSessionFeature(session.access, 'MULTI_BRANCH') ||
                  (!locations.isLoading && locations.data?.total === 0))
              }
              canUpdate={canUpdateLocation}
              api={api}
              onChanged={() => invalidate(keys.locations)}
            />
          </DTabsContent>
        ) : null}

        {canViewProfile && hasTaxCapability ? (
          <DTabsContent value="tax" className="mt-5">
            <BusinessTaxSection
              tax={configuration.data?.tax}
              loading={configuration.isLoading}
              canUpdate={canUpdateProfile}
              api={api}
              onChanged={() => invalidate(keys.configuration)}
            />
          </DTabsContent>
        ) : null}

        {canViewProfile ? (
          <DTabsContent value="numbering" className="mt-5">
            <BusinessNumberingSection
              preferences={numbering.data ?? []}
              loading={numbering.isLoading}
              canUpdate={canUpdateProfile}
              invoiceApplicable={session.effectiveEntitlements.products.includes('POS')}
              api={api}
              onChanged={() => invalidate(keys.numbering)}
            />
          </DTabsContent>
        ) : null}

        {canViewLoyalty ? (
          <DTabsContent value="loyalty" className="mt-5">
            <LoyaltyConfigurationSection api={loyaltyApi} canConfigure={canConfigureLoyalty} />
          </DTabsContent>
        ) : null}

        {canViewCommission ? (
          <DTabsContent value="commission" className="mt-5">
            <ProductCommissionSection
              api={commissionApi}
              canConfigure={canConfigureCommission}
              loadProducts={(q) =>
                catalogApi.listItems({
                  type: 'PRODUCT',
                  lifecycle: 'ACTIVE',
                  limit: 20,
                  ...(q ? { q } : {}),
                })
              }
            />
          </DTabsContent>
        ) : null}
      </DTabs>
    </BackofficePage>
  );
}
