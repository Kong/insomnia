import { useState } from 'react';

// TODO: remove unused view value
export type ActiveView = 'project' | 'git-results';

export function useActiveView() {
  const [activeView, setActiveView] = useState<ActiveView>('project');
  return { activeView, setActiveView };
}

export interface ProjectData {
  name: string;
  uri?: string;
  ref?: string;
  credentialsId?: string;
  connectRepositoryLater?: boolean;
  selectedAuthorEmail?: string | null;
  /**
   * Optional user-chosen parent folder to clone into. When set, the repo is
   * cloned into `<cloneParentDir>/<cloneFolderName || deriveRepoName(uri)>`;
   * when unset, Insomnia manages the location.
   */
  cloneParentDir?: string;
  /**
   * Optional user-chosen override for the folder name the repo is cloned into
   * (only meaningful alongside `cloneParentDir`). Falls back to
   * `deriveRepoName(uri)` (the git repo's own name) when unset.
   */
  cloneFolderName?: string;
}

const LAST_CLONE_DIR_KEY = 'insomnia.git.lastCloneParentDir';

export const getLastCloneParentDir = (): string => {
  try {
    return window.localStorage.getItem(LAST_CLONE_DIR_KEY) || '';
  } catch {
    return '';
  }
};

export const setLastCloneParentDir = (dir: string): void => {
  try {
    window.localStorage.setItem(LAST_CLONE_DIR_KEY, dir);
  } catch {
    // ignore storage errors
  }
};

/** Derive the destination folder name from a git URL (e.g. `…/foo.git` → `foo`). */
export const deriveRepoName = (uri?: string): string => {
  if (!uri) {
    return 'repository';
  }
  const trimmed = uri.trim().replace(/[/\\]+$/, '');
  const lastSegment = trimmed.split(/[/\\:]/).pop() || '';
  const name = lastSegment.replace(/\.git$/i, '').split(/[?#]/, 1)[0].trim();
  if (!name || name === '.' || name === '..') {
    return 'repository';
  }
  return name;
};

/**
 * The folder name a git clone into a custom location should use: the user's
 * explicit override (from the "Folder name" field, only shown once a custom
 * clone location is picked) when set, otherwise the repo's own name derived
 * from its URL.
 */
export const resolveCloneFolderName = (cloneFolderName?: string, uri?: string): string =>
  cloneFolderName?.trim() || deriveRepoName(uri);

export type ProjectType = 'local' | 'remote' | 'git';
