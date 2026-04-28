import React, {
  createContext,
  type FC,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { WorkspaceFileIssue } from '~/main/git-service';
import type { FileProblemsChangedPayload } from '~/sync/git/repo-file-watcher';
import { invariant } from '~/utils/invariant';

const mapIssuesByWorkspaceId = (issues: WorkspaceFileIssue[]) => {
  return Object.fromEntries(issues.map(issue => [issue.workspaceId, issue])) as Record<string, WorkspaceFileIssue>;
};

export interface GitFileIssuesValue {
  issuesByWorkspaceId: Record<string, WorkspaceFileIssue>;
  conflictsSuppressed: boolean;
}

const GitFileIssuesContext = createContext<GitFileIssuesValue | undefined>(undefined);

export const GitFileIssuesProvider: FC<PropsWithChildren<{ value: GitFileIssuesValue }>> = ({ value, children }) => {
  return React.createElement(GitFileIssuesContext.Provider, { value }, children);
};

export const useGitFileIssues = () => {
  const gitFileIssues = useContext(GitFileIssuesContext);

  invariant(gitFileIssues, 'useGitFileIssues must be used within the git file issues provider');

  return gitFileIssues;
};

export const useProjectGitFileIssues = ({
  projectId,
  gitRepositoryId,
}: {
  projectId?: string;
  gitRepositoryId?: string | null;
}): GitFileIssuesValue => {
  const [issuesByWorkspaceId, setIssuesByWorkspaceId] = useState<Record<string, WorkspaceFileIssue>>({});
  const [conflictsSuppressed, setConflictsSuppressed] = useState(false);

  const loadIssues = useCallback(async () => {
    if (!projectId || !gitRepositoryId) {
      setIssuesByWorkspaceId({});
      return;
    }

    try {
      const issues = await window.main.git.getProjectGitFileIssues({
        projectId,
        gitRepositoryId,
      });

      setIssuesByWorkspaceId(mapIssuesByWorkspaceId(issues));
    } catch (error) {
      console.warn('[git-file-issues] Failed to load workspace file problems', error);
    }
  }, [gitRepositoryId, projectId]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  useEffect(() => {
    if (!gitRepositoryId) {
      return;
    }

    return window.main.on('git.file-problems-changed', (_event, payload: FileProblemsChangedPayload) => {
      if (payload.repoId !== gitRepositoryId) {
        return;
      }

      setConflictsSuppressed(payload.conflictsSuppressed);
      setIssuesByWorkspaceId(mapIssuesByWorkspaceId(payload.workspaceIssues));
    });
  }, [gitRepositoryId]);

  return useMemo<GitFileIssuesValue>(
    () => ({
      issuesByWorkspaceId,
      conflictsSuppressed,
    }),
    [issuesByWorkspaceId, conflictsSuppressed],
  );
};
