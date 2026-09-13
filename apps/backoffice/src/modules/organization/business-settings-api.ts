import { ApiClient } from '@digvation/business-api';

export const BUSINESS_CONFIGURATION_CHANGED_EVENT =
  'digvation:business-configuration-changed';

export type NumberingNamespace = 'SALE' | 'EMPLOYEE' | 'INVOICE';
export type DashboardWidget =
  | 'TOP_ITEMS'
  | 'PAYMENT_MIX'
  | 'RECENT_TRANSACTIONS'
  | 'TOP_EMPLOYEES'
  | 'BUSINESS_INSIGHT';
export type ConfigurableReport =
  | 'business-performance'
  | 'transactions'
  | 'catalog-performance'
  | 'employee-performance'
  | 'attendance'
  | 'payments'
  | 'expenses'
  | 'cash'
  | 'settlements'
  | 'reconciliations'
  | 'tax'
  | 'locations';

export interface BusinessProfile {
  name: string | null;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BusinessPreferences {
  defaultLocale: 'id-ID' | 'en-US';
  timezone: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timeFormat: 'HH:mm' | 'hh:mm a';
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EffectiveBusinessConfiguration {
  profile: BusinessProfile & { configured: boolean };
  preferences: BusinessPreferences;
}

export interface NumberingPreference {
  namespace: NumberingNamespace;
  prefix: string;
  padding: number;
  currentSequence: number;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BusinessExperiencePreferences {
  hiddenDashboardWidgets: DashboardWidget[];
  hiddenReports: ConfigurableReport[];
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SellingLocation {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  isMain: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface PageRequest {
  limit: number;
  offset: number;
}

function configurationChanged<T>(request: Promise<T>): Promise<T> {
  return request.then((result) => {
    window.dispatchEvent(new Event(BUSINESS_CONFIGURATION_CHANGED_EVENT));
    return result;
  });
}

export class BusinessSettingsApi {
  public constructor(private readonly client: ApiClient) {}

  getProfile() {
    return this.client.get<BusinessProfile>('/api/v1/business-profile');
  }

  getConfiguration() {
    return this.client.get<EffectiveBusinessConfiguration>(
      '/api/v1/business-configuration',
    );
  }

  updateProfile(profile: BusinessProfile, name: string) {
    return configurationChanged(
      this.client.patch<BusinessProfile>('/api/v1/business-profile', {
        expectedVersion: profile.version,
        name,
      }),
    );
  }

  updatePreferences(
    preferences: BusinessPreferences,
    input: Omit<BusinessPreferences, 'version' | 'createdAt' | 'updatedAt'>,
  ) {
    return configurationChanged(
      this.client.patch<BusinessPreferences>('/api/v1/business-preferences', {
        expectedVersion: preferences.version,
        ...input,
      }),
    );
  }

  getNumbering() {
    return this.client.get<NumberingPreference[]>(
      '/api/v1/business-configuration/numbering',
    );
  }

  updateNumbering(
    preference: NumberingPreference,
    input: Pick<NumberingPreference, 'prefix' | 'padding'>,
  ) {
    return this.client.patch<NumberingPreference>(
      `/api/v1/business-configuration/numbering/${preference.namespace}`,
      {
        expectedVersion: preference.version,
        prefix: input.prefix,
        padding: input.padding,
      },
    );
  }

  getExperience() {
    return this.client.get<BusinessExperiencePreferences>(
      '/api/v1/business-configuration/experience',
    );
  }

  updateExperience(preferences: BusinessExperiencePreferences) {
    return configurationChanged(
      this.client.patch<BusinessExperiencePreferences>(
        '/api/v1/business-configuration/experience',
        {
          expectedVersion: preferences.version,
          hiddenDashboardWidgets: preferences.hiddenDashboardWidgets,
          hiddenReports: preferences.hiddenReports,
        },
      ),
    );
  }

  listLocations(page: PageRequest) {
    return this.client.get<Page<SellingLocation>>(
      `/api/v1/locations?limit=${page.limit}&offset=${page.offset}`,
    );
  }

  createLocation(input: {
    code: string;
    name: string;
    setAsMain?: boolean;
  }) {
    return this.client.post<SellingLocation>('/api/v1/locations', input);
  }

  updateLocation(
    location: SellingLocation,
    input: {
      name?: string;
      status?: SellingLocation['status'];
      setAsMain?: boolean;
    },
  ) {
    return this.client.patch<SellingLocation>(
      `/api/v1/locations/${location.id}`,
      { expectedVersion: location.version, ...input },
    );
  }
}
