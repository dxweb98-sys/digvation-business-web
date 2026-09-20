import type { AccessPermission } from './access-control-api';

type Locale = 'id' | 'en';
export type PermissionExperience = 'BACKOFFICE' | 'OPERATIONAL';

export interface AccessPermissionModuleView {
  key: string;
  label: string;
  order: number;
  permissions: AccessPermission[];
}

export interface AccessPermissionExperienceView {
  key: PermissionExperience;
  label: string;
  order: number;
  modules: AccessPermissionModuleView[];
}

export function groupAccessPermissions(
  permissions: readonly AccessPermission[],
  locale: Locale,
  search: string,
): AccessPermissionExperienceView[] {
  const keyword = search.trim().toLocaleLowerCase(locale);
  const experiences = new Map<PermissionExperience, AccessPermissionExperienceView>();

  for (const permission of permissions.filter(
    (item) => item.configurable && matchesPermission(item, locale, keyword),
  )) {
    for (const experience of presentationExperiences(permission.surface)) {
      let currentExperience = experiences.get(experience);
      if (!currentExperience) {
        currentExperience = {
          key: experience,
          label: experience === 'BACKOFFICE' ? 'Backoffice' : 'Operational',
          order: experience === 'BACKOFFICE' ? 10 : 20,
          modules: [],
        };
        experiences.set(experience, currentExperience);
      }
      let module = currentExperience.modules.find(
        (item) => item.key === permission.businessArea.key,
      );
      if (!module) {
        module = {
          key: permission.businessArea.key,
          label: permission.businessArea.label[locale],
          order: permission.businessArea.order,
          permissions: [],
        };
        currentExperience.modules.push(module);
      }
      module.permissions.push(permission);
    }
  }

  return [...experiences.values()]
    .map((experience) => ({
      ...experience,
      modules: experience.modules
        .map((module) => ({
          ...module,
          permissions: module.permissions.sort(
            (left, right) => left.order - right.order || left.key.localeCompare(right.key),
          ),
        }))
        .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key)),
    }))
    .sort((left, right) => left.order - right.order);
}

function presentationExperiences(
  surface: AccessPermission['surface'],
): readonly PermissionExperience[] {
  if (surface === 'BOTH') return ['BACKOFFICE', 'OPERATIONAL'];
  return surface === 'BACKOFFICE'
    ? ['BACKOFFICE']
    : surface === 'OPERATIONAL'
      ? ['OPERATIONAL']
      : [];
}

function matchesPermission(permission: AccessPermission, locale: Locale, keyword: string): boolean {
  if (!keyword) return true;
  return [
    permission.label[locale],
    permission.businessArea.label[locale],
    permission.section.label[locale],
    permission.key,
  ].some((value) => value.toLocaleLowerCase(locale).includes(keyword));
}
