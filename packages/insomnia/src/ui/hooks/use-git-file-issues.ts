import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';

import type { WorkspaceFileIssue } from '~/main/git-service';
import type { FileProblemsChangedPayload } from '~/sync/git/repo-file-watcher';

const mapIssuesByWorkspaceId = (issues: WorkspaceFileIssue[]) => {
  return Object.fromEntries(issues.map(issue => [issue.workspaceId, issue])) as Record<string, WorkspaceFileIssue>;
};

interface GitFileIssuesValue {
  issuesByWorkspaceId: Record<string, WorkspaceFileIssue>;
  getWorkspaceIssue: (workspaceId: string) => WorkspaceFileIssue | undefined;
  reloadIssues: () => Promise<void>;
}

const emptyGitFileIssuesValue: GitFileIssuesValue = {
  issuesByWorkspaceId: {},
  getWorkspaceIssue: (_workspaceId: string) => {
    return;
  },
  reloadIssues: async () => {},
};

export const useProjectGitFileIssues = ({
  projectId,
  gitRepositoryId,
}: {
  projectId?: string;
  gitRepositoryId?: string | null;
}): GitFileIssuesValue => {
  const [issuesByWorkspaceId, setIssuesByWorkspaceId] = useState<Record<string, WorkspaceFileIssue>>({});

  const reloadIssues = useCallback(async () => {
    if (!projectId || !gitRepositoryId) {
      setIssuesByWorkspaceId({});
      return;
    }

    try {
      const issues = await window.main.git.getProjectGitFileIssues({
        projectId,
        gitRepositoryId,
      });
      console.log('[git-file-issues] Loaded workspace file problems', issues);

      setIssuesByWorkspaceId(mapIssuesByWorkspaceId(issues));
    } catch (error) {
      console.warn('[git-file-issues] Failed to load workspace file problems', error);
    }
  }, [gitRepositoryId, projectId]);

  useEffect(() => {
    reloadIssues();
  }, [reloadIssues]);

  useEffect(() => {
    if (!gitRepositoryId) {
      return;
    }

    return window.main.on('git.file-problems-changed', (_event, payload: FileProblemsChangedPayload) => {
      if (payload.repoId !== gitRepositoryId) {
        return;
      }

      setIssuesByWorkspaceId(mapIssuesByWorkspaceId(payload.workspaceIssues));
    });
  }, [gitRepositoryId]);

  return useMemo<GitFileIssuesValue>(
    () => ({
      issuesByWorkspaceId,
      getWorkspaceIssue: (workspaceId: string) => issuesByWorkspaceId[workspaceId],
      reloadIssues,
    }),
    [issuesByWorkspaceId, reloadIssues],
  );
};

export const useGitFileIssues = () => useOutletContext<GitFileIssuesValue | undefined>() ?? emptyGitFileIssuesValue;
