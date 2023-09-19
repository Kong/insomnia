import { getCurrentSessionId } from '../../account/session';
import { database } from '../../common/database';
import * as models from '../../models';
import { isScratchpadProject, Project } from '../../models/project';
import { Workspace } from '../../models/workspace';
import { invariant } from '../../utils/invariant';
import { initializeLocalBackendProjectAndMarkForSync, pushSnapshotOnInitialize } from './initialize-backend-project';
import { VCS } from './vcs';

let status: 'idle' | 'pending' | 'error' | 'completed' = 'idle';

// TODO:
// Error handling and return type for errors
// Should we migrate empty projects? We can but should we
export const shouldRunMigration = async () => {
  const localProjects = await database.find<Project>(models.project.type, {
    remoteId: null,
  });

  return localProjects.filter(project => !isScratchpadProject(project)).length > 0;
};

export const migrateLocalToCloudProjects = async (vcs: VCS) => {
  if (status !== 'idle' && status !== 'error') {
    return;
  }

  status = 'pending';

  try {
    const sessionId = getCurrentSessionId();
    invariant(sessionId, 'User must be logged in to migrate projects');

    // Local projects except scratchpad
    const localProjects = await database.find<Project>(models.project.type, {
      remoteId: null,
      _id: { $ne: models.project.SCRATCHPAD_PROJECT_ID },
    });

    // @TODO There's a chance user's can't create projects in their personal organization. We should handle this case.
    for (const localProject of localProjects) {
      // -- Create a remote project
      const newCloudProject = await window.main.insomniaFetch<{ id: string; name: string; organizationId: string }>({
        path: '/v1/organizations/personal/team-projects',
        method: 'POST',
        data: {
          name: localProject.name,
        },
        sessionId,
      });

      const project = await models.project.update(localProject, {
        name: newCloudProject.name,
        remoteId: newCloudProject.id,
        parentId: newCloudProject.organizationId,
      });

      // For each workspace in the local project
      const projectWorkspaces = (await database.find<Workspace>(models.workspace.type, {
        parentId: localProject._id,
      }));

      for (const workspace of projectWorkspaces) {
        const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);

        // Initialize Sync on the workspace if it's not using Git sync
        try {
          if (!workspaceMeta.gitRepositoryId) {
            invariant(vcs, 'VCS must be initialized');

            await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace });
            await pushSnapshotOnInitialize({ vcs, workspace, project });
          }
        } catch (e) {
          console.warn('Failed to initialize sync on workspace. This will be retried when the workspace is opened on the app.', e);
          // TODO: here we should show the try again dialog
        }
      }
    }

    status = 'completed';
  } catch (err) {
    console.warn('Failed to migrate projects to cloud', err);
  }
};
