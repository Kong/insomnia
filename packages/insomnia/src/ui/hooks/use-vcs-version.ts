import { useProjectIndexLoaderData } from '../../routes/organization.$organizationId.project.$projectId._index';
import { useWorkspaceLoaderData } from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';

// We use this hook to determine if the active workspace has been updated from the Git VCS
// For example, by pulling a new version from the remote, switching branches, etc.
export function useGitVCSVersion() {
  const workspaceData = useWorkspaceLoaderData();
  const projectData = useProjectIndexLoaderData();
  const gitRepository = workspaceData?.gitRepository || projectData?.activeProjectGitRepository;

  return `${gitRepository?.cachedGitLastCommitTime}:${gitRepository?.cachedGitRepositoryBranch}`;
}
