import type { AccessPermission } from './access-control-api';

type Locale = 'id' | 'en';

export interface AccessPermissionAreaView {
  key: string;
  label: string;
  order: number;
  permissions: AccessPermission[];
}

export interface AccessPermissionSectionView {
  key: string;
  label: string;
  order: number;
  areas: AccessPermissionAreaView[];
}

export function groupAccessPermissions(
  permissions: readonly AccessPermission[],
  locale: Locale,
  search: string,
): AccessPermissionSectionView[] {
  const keyword = search.trim().toLocaleLowerCase(locale);
  const configurable = permissions.filter((permission) => permission.configurable);
  const filtered = configurable.filter((permission) =>
    matchesPermission(permission, locale, keyword),
  );
  const sections = new Map<string, AccessPermissionSectionView>();

  for (const permission of filtered) {
    let currentSection = sections.get(permission.section.key);
    if (!currentSection) {
      currentSection = {
        key: permission.section.key,
        label: permission.section.label[locale],
        order: permission.section.order,
        areas: [],
      };
      sections.set(permission.section.key, currentSection);
    }

    let currentArea = currentSection.areas.find(
      (area) => area.key === permission.businessArea.key,
    );
    if (!currentArea) {
      currentArea = {
        key: permission.businessArea.key,
        label: permission.businessArea.label[locale],
        order: permission.businessArea.order,
        permissions: [],
      };
      currentSection.areas.push(currentArea);
    }
    currentArea.permissions.push(permission);
  }

  return [...sections.values()]
    .map((currentSection) => ({
      ...currentSection,
      areas: currentSection.areas
        .map((currentArea) => ({
          ...currentArea,
          permissions: currentArea.permissions.sort(
            (left, right) => left.order - right.order || left.key.localeCompare(right.key),
          ),
        }))
        .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key)),
    }))
    .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
}

function matchesPermission(
  permission: AccessPermission,
  locale: Locale,
  keyword: string,
): boolean {
  if (!keyword) return true;

  return [
    permission.label[locale],
    permission.section.label[locale],
    permission.businessArea.label[locale],
    permission.capability ?? '',
    permission.product ?? '',
    permission.key,
  ].some((value) => value.toLocaleLowerCase(locale).includes(keyword));
}
