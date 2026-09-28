import { DAvatar } from '@digvation/ui';
import { CarFront, Cog, Hash, Phone, RefreshCcw } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatPhoneForDisplay } from '../model/format-phone';
import { IconActionButton } from './icon-action-button';

/** Customer identity lines: name first, phone as the supporting line. */
export function CustomerIdentity({ name, phone }: { name: string; phone: string }) {
  return (
    <>
      <p className="truncate text-sm font-semibold text-(--color-text)">{name}</p>
      <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-(--color-text-muted)">
        <Phone className="size-3 shrink-0" aria-hidden="true" />
        {formatPhoneForDisplay(phone)}
      </p>
    </>
  );
}

function VehicleMeta({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] font-medium text-(--color-text-muted)">
        {icon}
        {label}
      </dt>
      <dd className="truncate text-[13px] text-(--color-text)">{value}</dd>
    </div>
  );
}

/**
 * Vehicle identity lines: plate is primary, chassis and engine are labelled
 * metadata. Engine is optional because the Queue contract does not carry it.
 */
export function VehicleIdentity({
  plate,
  chassis,
  engine,
  copy,
}: {
  plate: string;
  chassis: string;
  engine?: string;
  copy: (value: string) => string;
}) {
  return (
    <>
      <p className="truncate text-base font-bold tracking-wide text-(--color-text)">{plate}</p>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-3">
        <VehicleMeta
          icon={<Hash className="size-3 shrink-0" aria-hidden="true" />}
          label={copy('Chassis number')}
          value={chassis}
        />
        {engine !== undefined ? (
          <VehicleMeta
            icon={<Cog className="size-3 shrink-0" aria-hidden="true" />}
            label={copy('Engine number')}
            value={engine}
          />
        ) : null}
      </dl>
    </>
  );
}

export function VehicleMarker() {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--color-surface-muted) text-(--color-text-muted)">
      <CarFront className="size-5" aria-hidden="true" />
    </span>
  );
}

export function CustomerMarker({ name }: { name: string }) {
  return <DAvatar name={name} size="md" />;
}

/**
 * Confirmed identity (Customer or Vehicle). One subtle border, no shadow; the
 * label and the optional replace action share the first line so both blocks
 * read alike everywhere in Workshop.
 */
export function IdentityBlock({
  leading,
  label,
  replaceLabel,
  onReplace,
  children,
}: {
  leading: ReactNode;
  label: string;
  replaceLabel?: string;
  onReplace?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-(--color-border) bg-(--color-surface-muted)/30 px-3.5 py-3">
      {leading}
      <div className="min-w-0 flex-1">
        <div className="-mt-1 flex min-h-6 items-center justify-between gap-3">
          <p className="text-[11px] font-semibold text-(--color-text-muted)">{label}</p>
          {replaceLabel && onReplace ? (
            <span className="-mr-2">
              <IconActionButton icon={RefreshCcw} label={replaceLabel} onClick={onReplace} />
            </span>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
