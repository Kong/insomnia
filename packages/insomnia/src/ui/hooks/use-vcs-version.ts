import { useProjectLoaderData } from '~/routes/organization.$organizationId.project.$projectId';

import { useWorkspaceLoaderData } from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';

// We use this hook to determine if the active workspace should remount editors due to
// Git/VCS changes or a successful FS watcher sync of the backing YAML file.
export function useGitVCSVersion() {
  const workspaceData = useWorkspaceLoaderData();
  const projectData = useProjectLoaderData();
  const gitRepository = workspaceData?.gitRepository || projectData?.activeProjectGitRepository;
  const gitFileLastSyncTime = workspaceData?.activeWorkspaceMeta?.gitFileLastSyncTime;

  return `${gitRepository?.cachedGitLastCommitTime}:${gitRepository?.cachedGitRepositoryBranch}:${gitFileLastSyncTime}`;
}
