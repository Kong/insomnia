import { models } from 'insomnia-data';

import { useProjectLoaderData } from '~/routes/organization.$organizationId.project.$projectId';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { GitProjectSyncDropdown } from '~/ui/components/dropdowns/git-project-sync-dropdown';
import { WorkspaceSyncDropdown } from '~/ui/components/dropdowns/workspace-sync-dropdown';

export function SyncBar() {
  const { activeProject, activeProjectGitRepository } = useProjectLoaderData() || {};
  const { activeWorkspace } = useWorkspaceLoaderData() || {};

  if (activeWorkspace) {
    return <WorkspaceSyncDropdown />;
  }

  if (activeProject) {
    return models.project.isGitProject(activeProject) ? (
      <GitProjectSyncDropdown
        key={activeProjectGitRepository?._id}
        gitRepository={activeProjectGitRepository}
        activeProject={activeProject}
      />
    ) : null;
  }

  return null;
}
