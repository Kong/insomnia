import { getCurrentSessionId } from '../../account/session';
import { database } from '../../common/database';
import * as models from '../../models';
import { Project, RemoteProject } from '../../models/project';
import { Workspace } from '../../models/workspace';
import { invariant } from '../../utils/invariant';
import { initializeLocalBackendProjectAndMarkForSync, pushSnapshotOnInitialize } from './initialize-backend-project';
import { VCS } from './vcs';

let status: 'idle' | 'pending' | 'error' | 'completed' = 'idle';

// TODO:
// Error handling and return type for errors

// Migration:
// Team ~= Project > Workspaces
// In the previous API: { _id: 'proj_team_123', remoteId: 'team_123', parentId: null }

// Organization > TeamProject > Workspaces
// In the new API: { _id: 'proj_team_123', remoteId: 'proj_team_123', parentId: 'team_123' }

export const shouldRunMigration = async () => {
  const localProjects = await database.find<Project>(models.project.type, {
    remoteId: null,
    _id: { $ne: models.project.SCRATCHPAD_PROJECT_ID },
  });

  const legacyRemoteProjects = await database.find<RemoteProject>(models.project.type, {
    remoteId: { $ne: null },
    parentId: null,
  });

  return localProjects.length > 0 || legacyRemoteProjects.length > 0;
};

// Second time we run this, whats gonna happen?
// we will get duplicate projects in the cloud and local with the same but no workspaces in the duplicate

export const migrateLocalToCloudProjects = async (vcs: VCS) => {
  if (status !== 'idle' && status !== 'error') {
    return;
  }

  status = 'pending';

  try {
    const sessionId = getCurrentSessionId();
    invariant(sessionId, 'User must be logged in to migrate projects');

    // Migrate legacy remote projects to new organization structure
    const legacyRemoteProjects = await database.find<RemoteProject>(models.project.type, {
      remoteId: { $ne: null },
      parentId: null,
    });

    for (const remoteProject of legacyRemoteProjects) {
      await models.project.update(remoteProject, {
        // Remote Id was previously the teamId
        parentId: remoteProject.remoteId,
        // _id was previously the remoteId
        remoteId: remoteProject._id,
      });
    }

    // Local projects except scratchpad
    const localProjects = await database.find<Project>(models.project.type, {
      remoteId: null,
      _id: { $ne: models.project.SCRATCHPAD_PROJECT_ID },
    });
    for (const localProject of localProjects) {
      // -- Unsafe to run twice, will cause duplicates unless we would need to match ids
      const newCloudProject = await window.main.insomniaFetch<{ id: string; name: string; organizationId: string } | void>({
        path: '/v1/organizations/personal/team-projects',
        method: 'POST',
        data: {
          name: localProject.name,
        },
        sessionId,
      });

      invariant(typeof newCloudProject?.id === 'string', 'Failed to create remote project');

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
    throw err;
  }
};
