import type { AccessPermission } from '../access-control-api';
import { groupAccessPermissions, type PermissionExperience } from '../permission-catalog';

/**
 * One navigable permission category: a business area inside an experience (Backoffice or
 * Operational). It is a presentation view over the Runtime catalog; permission keys and
 * semantics are never changed here.
 */
export interface PermissionCategory {
  key: string;
  experience: PermissionExperience;
  experienceLabel: string;
  label: string;
  permissions: AccessPermission[];
}

type Locale = 'id' | 'en';

/** Categories in catalog order. A non-empty `search` keeps only matching permissions. */
export function permissionCategories(
  permissions: readonly AccessPermission[],
  locale: Locale,
  search = '',
): PermissionCategory[] {
  return groupAccessPermissions(permissions, locale, search).flatMap((experience) =>
    experience.modules.map((module) => ({
      key: `${experience.key}:${module.key}`,
      experience: experience.key,
      experienceLabel: experience.label,
      label: module.label,
      permissions: module.permissions,
    })),
  );
}

/** How many of the category's permissions are selected. */
export function selectedIn(category: PermissionCategory, selected: ReadonlySet<string>): number {
  return category.permissions.filter((permission) => selected.has(permission.key)).length;
}

export interface ExperienceSummary {
  key: PermissionExperience;
  label: string;
  /** Distinct permission keys in this area. */
  total: number;
  /** Distinct selected keys in this area. */
  selected: number;
}

/** Per-area distinct totals; a key shared by several categories of one area counts once. */
export function experienceSummaries(
  categories: readonly PermissionCategory[],
  selected: ReadonlySet<string>,
): ExperienceSummary[] {
  const byExperience = new Map<PermissionExperience, { label: string; keys: Set<string> }>();
  for (const category of categories) {
    const entry = byExperience.get(category.experience) ?? {
      label: category.experienceLabel,
      keys: new Set<string>(),
    };
    for (const permission of category.permissions) entry.keys.add(permission.key);
    byExperience.set(category.experience, entry);
  }
  return [...byExperience.entries()].map(([key, entry]) => ({
    key,
    label: entry.label,
    total: entry.keys.size,
    selected: [...entry.keys].filter((item) => selected.has(item)).length,
  }));
}

/** Distinct configurable permission keys: a BOTH-surface permission appears in two categories. */
export function configurableKeys(permissions: readonly AccessPermission[]): string[] {
  return [...new Set(permissions.filter((item) => item.configurable).map((item) => item.key))];
}

export function sameSelection(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((key) => rightSet.has(key));
}
