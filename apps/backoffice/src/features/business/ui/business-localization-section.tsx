import { CalendarDays, Clock, Globe2, Languages } from 'lucide-react';
import { useState } from 'react';

import {
  RecordInfoTile,
  RecordPanel,
  RecordPanelBody,
  RecordPanelHeader,
} from '../../../shared/ui/record-dialog';
import type { BusinessPreferences, BusinessSettingsApi } from '../api/business-settings-api';
import { useBusinessLocalization } from '../localization/use-business-localization';
import {
  dateFormatExample,
  timeFormatLabel,
  timezoneName,
} from '../model/business-preferences-format';
import { BusinessLocalizationDialog } from './business-localization-dialog';
import { SectionEditButton, TilesSkeleton } from './business-section-layout';

const iconClass = 'size-3.5';

/** Language and date/time display, view-first; edits go through Business Preferences. */
export function BusinessLocalizationSection({
  preferences,
  loading,
  canUpdate,
  api,
  onChanged,
}: {
  preferences?: BusinessPreferences | undefined;
  loading: boolean;
  canUpdate: boolean;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy, locale } = useBusinessLocalization();
  const [open, setOpen] = useState(false);
  const zoneName = preferences
    ? timezoneName(preferences.timezone, locale === 'id' ? 'id-ID' : 'en-US')
    : null;

  return (
    <RecordPanel padded={false} ariaLabel={copy('Language & time')}>
      <RecordPanelHeader
        title={copy('Language & time')}
        trailing={
          canUpdate && preferences ? (
            <SectionEditButton label={copy('Edit language & time')} onClick={() => setOpen(true)} />
          ) : null
        }
      />
      <RecordPanelBody>
        <p className="text-sm text-(--color-text-muted)">
          {copy('Default language and how dates and times are shown for the business.')}
        </p>
        {loading ? (
          <TilesSkeleton count={4} />
        ) : preferences ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RecordInfoTile
              label={copy('Default language')}
              icon={<Languages className={iconClass} aria-hidden="true" />}
              value={copy(preferences.defaultLocale === 'en-US' ? 'English' : 'Indonesian')}
            />
            <RecordInfoTile
              label={copy('Timezone')}
              icon={<Globe2 className={iconClass} aria-hidden="true" />}
              value={
                <>
                  {zoneName ?? preferences.timezone}
                  {zoneName ? (
                    <span className="mt-0.5 block font-mono text-xs font-normal text-(--color-text-muted)">
                      {preferences.timezone}
                    </span>
                  ) : null}
                </>
              }
            />
            <RecordInfoTile
              label={copy('Date format')}
              icon={<CalendarDays className={iconClass} aria-hidden="true" />}
              value={
                <>
                  {dateFormatExample(preferences.dateFormat)}
                  <span className="mt-0.5 block font-mono text-xs font-normal text-(--color-text-muted)">
                    {preferences.dateFormat}
                  </span>
                </>
              }
            />
            <RecordInfoTile
              label={copy('Time format')}
              icon={<Clock className={iconClass} aria-hidden="true" />}
              value={timeFormatLabel(preferences.timeFormat, copy)}
            />
          </div>
        ) : null}
      </RecordPanelBody>
      {open && preferences ? (
        <BusinessLocalizationDialog
          preferences={preferences}
          api={api}
          onClose={() => setOpen(false)}
          onSaved={onChanged}
        />
      ) : null}
    </RecordPanel>
  );
}
