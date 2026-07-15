import { models } from 'insomnia-data';

import { useProjectLoaderData } from '~/routes/organization.$organizationId.project.$projectId';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { CloudSyncProjectBar } from '~/ui/components/dropdowns/cloud-sync-project-bar';
import { GitProjectSyncDropdown } from '~/ui/components/dropdowns/git-project-sync-dropdown';
import { LocalProjectBar } from '~/ui/components/dropdowns/local-project-bar';
import { WorkspaceSyncDropdown } from '~/ui/components/dropdowns/workspace-sync-dropdown';

export function SyncBar() {
  const { activeProject, activeProjectGitRepository } = useProjectLoaderData() || {};
  const { activeWorkspace } = useWorkspaceLoaderData() || {};

  if (activeWorkspace) {
    return <WorkspaceSyncDropdown />;
  }

  if (activeProject) {
    return (
      <>
        {activeProject && models.project.isGitProject(activeProject) && (
          <GitProjectSyncDropdown
            key={activeProjectGitRepository?._id}
            gitRepository={activeProjectGitRepository}
            activeProject={activeProject}
          />
        )}
        {activeProject &&
          models.project.isLocalProject(activeProject) &&
          !models.project.isGitProject(activeProject) && <LocalProjectBar />}
        {activeProject && models.project.isRemoteProject(activeProject) && <CloudSyncProjectBar />}
      </>
    );
  }

  return null;
}
