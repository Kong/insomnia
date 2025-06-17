import { parse } from 'yaml';

import GitVCS from '../sync/git/git-vcs';
import { getGitRepository } from './git-service';

interface GitChangesLoaderData {
  changes: {
    staged: {
      name: string;
      path: string;
    }[];
    unstaged: {
      name: string;
      path: string;
    }[];
  };
  branch: string;
  errors?: string[];
}

const gitChangesLoader = async ({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}): Promise<GitChangesLoaderData> => {
  try {
    await getGitRepository({ projectId, workspaceId });
    const branch = await GitVCS.getCurrentBranch();

    const { changes } = await getGitChanges(GitVCS);

    return {
      branch,
      changes,
    };
  } catch {
    return gitWorkerServiceFallbacks.gitChangesLoader();
  }
};

async function getGitChanges(vcs: typeof GitVCS) {
  const changes = await vcs.status();

  return {
    changes,
    hasUncommittedChanges: changes.staged.length > 0 || changes.unstaged.length > 0,
  };
}

interface GitStatusResult {
  status: {
    localChanges: number;
  };
}

const gitStatus = async ({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}): Promise<GitStatusResult> => {
  try {
    await getGitRepository({ workspaceId, projectId });
    const { changes } = await getGitChanges(GitVCS);
    const localChanges = changes.staged.length + changes.unstaged.length;

    return {
      status: {
        localChanges,
      },
    };
  } catch (e) {
    console.error(e);
    return gitWorkerServiceFallbacks.gitStatus();
  }
};

function getPreviewItemName(previewDiffItem: { before: string; after: string }) {
  let prevName = '';
  let nextName = '';

  try {
    const prev = parse(previewDiffItem.before);

    if ((prev && 'fileName' in prev) || 'name' in prev) {
      prevName = prev.fileName || prev.name;
    }
  } catch {
    // Nothing to do
  }

  try {
    const next = parse(previewDiffItem.after);
    if ((next && 'fileName' in next) || 'name' in next) {
      nextName = next.fileName || next.name;
    }
  } catch {
    // Nothing to do
  }

  return nextName || prevName;
}

type GitDiffResult =
  | {
      name: string;
      diff?: {
        before: string;
        after: string;
      };
    }
  | {
      errors: string[];
    };

const diffFileLoader = async ({
  projectId,
  workspaceId,
  filepath,
  staged,
}: {
  projectId: string;
  workspaceId?: string;
  filepath: string;
  staged: boolean;
}): Promise<GitDiffResult> => {
  try {
    await getGitRepository({ workspaceId, projectId });
    const fileStatus = await GitVCS.fileStatus(filepath);

    const diff = staged
      ? {
          before: fileStatus.head,
          after: fileStatus.stage,
        }
      : {
          before: fileStatus.stage || fileStatus.head,
          after: fileStatus.workdir,
        };

    return {
      name: getPreviewItemName(diff) || filepath,
      diff,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Error while unstaging changes';
    return gitWorkerServiceFallbacks.diffFileLoader(errorMessage);
  }
};

/**
 * List of commands that should be run in a worker process.
 *
 * These commands are expected to be long-running or resource-intensive, so they should not block the main process.
 *
 * ! Note: Should only include read-only commands to avoid the risk of data corruption.
 */
const workerProcessCommands = ['gitStatus', 'diffFileLoader', 'gitChangesLoader'] as const;
export type WorkerProcessCommand = (typeof workerProcessCommands)[number];

// This is intended to be used as a fallback for the gitServiceAPI in case of errors or unavailability.
export const gitWorkerServiceFallbacks = {
  gitStatus: () => {
    return {
      status: {
        localChanges: 0,
      },
    };
  },
  diffFileLoader: (errorMessage = 'Failed to load diff') => {
    return {
      errors: [errorMessage],
    };
  },
  gitChangesLoader: () => {
    return {
      branch: '',
      changes: {
        staged: [],
        unstaged: [],
      },
      errors: ['Failed to get changes'],
    };
  },
};

export const gitWorkerServiceAPI = {
  gitStatus,
  diffFileLoader,
  gitChangesLoader,
};
export type GitWorkerServiceAPI = typeof gitWorkerServiceAPI;
export type GitWorkerServiceAPIKeys = keyof GitWorkerServiceAPI;
