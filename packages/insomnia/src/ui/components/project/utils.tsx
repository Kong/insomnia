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
   * cloned into `<cloneParentDir>/<repo-name>`; when unset, Insomnia manages the
   * location. See GIT_LOCAL_REPOS_DESIGN.md.
   */
  cloneParentDir?: string;
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
  const cleaned = uri.trim().replace(/\.git$/i, '').replace(/[/\\]+$/, '');
  const last = cleaned.split(/[/\\:]/).pop();
  return last || 'repository';
};

export type ProjectType = 'local' | 'remote' | 'git';
