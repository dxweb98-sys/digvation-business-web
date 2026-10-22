import {
  activityEventLabel,
  activityNamespaceLabel,
  activityTargetLabel,
} from '../../../app/localization/human-readable-labels';
import type { ActivityActor, ActivityEvent } from '../api/activity-api';

export const ACTIVITY_CATEGORIES = [
  'SECURITY',
  'CONFIGURATION',
  'FINANCE',
  'CATALOG',
  'TAX',
  'PRICING',
  'WORKFORCE',
  'SALES',
  'PAYMENT',
  'FULFILLMENT',
] as const;

type Locale = 'id' | 'en';

/** "@username · Role, Role", or empty when the actor has neither. */
export function actorContext(actor: Pick<ActivityActor, 'username' | 'roleNames'>): string {
  return [actor.username ? `@${actor.username}` : null, actor.roleNames.join(', ') || null]
    .filter(Boolean)
    .join(' · ');
}

export function actorCompactLabel(
  actor: Pick<ActivityActor, 'displayName' | 'username' | 'roleNames'> | null,
): string {
  if (!actor) return '';
  const username = actor.username ? `(@${actor.username})` : '';
  const roles = actor.roleNames.length ? ` · ${actor.roleNames.join(', ')}` : '';
  return `${actor.displayName}${username ? ` ${username}` : ''}${roles}`;
}

/** The affected business record, readable; undefined when the event has none. */
export function targetSummary(item: ActivityEvent, locale: Locale): string | undefined {
  if (!item.target || !hasBusinessTarget(item)) return undefined;
  const display = item.target.displayName;
  const reference = item.target.reference
    ? activityNamespaceLabel(item.target.reference, locale)
    : undefined;
  const fallback = activityTargetLabel(item.target.type, locale);
  return [display ?? fallback, reference].filter(Boolean).join(' · ');
}

function hasBusinessTarget(item: ActivityEvent) {
  return item.eventType !== 'LOGIN_SUCCEEDED' && item.eventType !== 'LOGOUT';
}

export function outcomeVariant(value: string): 'success' | 'warning' | 'danger' | 'outline' {
  return value === 'SUCCEEDED'
    ? 'success'
    : value === 'REJECTED'
      ? 'warning'
      : value === 'FAILED'
        ? 'danger'
        : 'outline';
}

export function sourceLabel(value: ActivityEvent['source'], locale: Locale) {
  if (!value) return locale === 'id' ? 'Tidak diketahui' : 'Unknown';
  if (value === 'SYSTEM') return locale === 'id' ? 'Sistem' : 'System';
  if (value === 'OPERATIONAL') return 'Operational';
  return 'Backoffice';
}

export function actionLabel(value: string, locale: Locale) {
  if (value === 'LOGIN_SUCCEEDED')
    return locale === 'id' ? 'Masuk ke aplikasi' : 'Signed in to application';
  if (value === 'LOGOUT')
    return locale === 'id' ? 'Keluar dari aplikasi' : 'Signed out of application';
  return activityEventLabel(value, locale);
}
