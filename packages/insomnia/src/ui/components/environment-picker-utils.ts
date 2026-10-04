import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { fuzzyMatch } from 'insomnia-data/common';

export interface ProjectEnvironmentItem {
  id: string;
  name: string;
  icon: IconProp;
  color?: string | null;
  isBase: boolean;
  // Only set on project environment files: the workspace the row's edit button navigates to.
  workspaceId?: string;
  // Only set on sub-environments: the id of the project environment file they belong to.
  parentId?: string;
}

/**
 * Narrows the flattened project environment list down to the rows matching `filter`.
 *
 * Files and their sub-environments live in the same flat list, so a file is kept when it matches or
 * when one of its sub-environments does, and a sub-environment is kept when it matches or when its
 * file does — otherwise a match would render indented underneath a file that is no longer there.
 */
export const filterProjectEnvironmentItems = (
  items: ProjectEnvironmentItem[],
  filter: string,
): ProjectEnvironmentItem[] => {
  if (!filter.trim()) {
    return items;
  }

  const matchedIds = new Set(
    items
      .filter(item => Boolean(fuzzyMatch(filter, item.name, { splitSpace: false, loose: true })?.indexes))
      .map(item => item.id),
  );
  const filesWithMatchingSubEnvironment = new Set(
    items.flatMap(item => (item.parentId && matchedIds.has(item.id) ? [item.parentId] : [])),
  );

  return items.filter(
    item =>
      matchedIds.has(item.id) ||
      filesWithMatchingSubEnvironment.has(item.id) ||
      Boolean(item.parentId && matchedIds.has(item.parentId)),
  );
};
