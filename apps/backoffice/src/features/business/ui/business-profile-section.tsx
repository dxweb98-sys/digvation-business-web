import { Building2, CalendarDays } from 'lucide-react';
import { useState } from 'react';

import {
  RecordInfoTile,
  RecordPanel,
  RecordPanelBody,
  RecordPanelHeader,
} from '../../../shared/ui/record-dialog';
import type { BusinessProfile, BusinessSettingsApi } from '../api/business-settings-api';
import { useBusinessLocalization } from '../localization/use-business-localization';
import { BusinessProfileDialog } from './business-profile-dialog';
import { SectionEditButton, TilesSkeleton } from './business-section-layout';

/** Business identity, view-first; edits go through the Business Profile command. */
export function BusinessProfileSection({
  profile,
  loading,
  canUpdate,
  api,
  onChanged,
}: {
  profile?: BusinessProfile | undefined;
  loading: boolean;
  canUpdate: boolean;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy, formatDate } = useBusinessLocalization();
  const [open, setOpen] = useState(false);

  return (
    <RecordPanel padded={false} ariaLabel={copy('Business information')}>
      <RecordPanelHeader
        title={copy('Business information')}
        trailing={
          canUpdate && profile ? (
            <SectionEditButton label={copy('Edit information')} onClick={() => setOpen(true)} />
          ) : null
        }
      />
      <RecordPanelBody>
        <p className="text-sm text-(--color-text-muted)">
          {copy('The business name shown in Backoffice and Operational.')}
        </p>
        {loading ? (
          <TilesSkeleton count={2} />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RecordInfoTile
              label={copy('Business name')}
              icon={<Building2 className="size-3.5" aria-hidden="true" />}
              value={profile?.name}
            />
            <RecordInfoTile
              label={copy('Last updated')}
              icon={<CalendarDays className="size-3.5" aria-hidden="true" />}
              value={
                profile?.updatedAt
                  ? formatDate(new Date(profile.updatedAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : null
              }
            />
          </div>
        )}
      </RecordPanelBody>
      {open && profile ? (
        <BusinessProfileDialog
          profile={profile}
          api={api}
          onClose={() => setOpen(false)}
          onSaved={onChanged}
        />
      ) : null}
    </RecordPanel>
  );
}
