import { getCurrentSessionId } from '../../account/session';
import { database } from '../../common/database';
import * as models from '../../models';
import { isRemoteProject } from '../../models/project';
import { isScratchpad, Workspace } from '../../models/workspace';
import { invariant } from '../../utils/invariant';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { initializeLocalBackendProjectAndMarkForSync, pushSnapshotOnInitialize } from './initialize-backend-project';
import { getVCS, initVCS } from './vcs';

let status: 'idle' | 'pending' | 'error' | 'completed' = 'idle';

export const migrateLocalToCloudProjects = async () => {
  if (status !== 'idle' && status !== 'error') {
    return;
  }

  status = 'pending';

  try {
    const sessionId = getCurrentSessionId();
    invariant(sessionId, 'User must be logged in to migrate projects');
    // Get all local projects
    const allProjects = await models.project.all();
    const projectsToMigrate = allProjects.filter(p => !isRemoteProject(p));

    // Nothing to migrate if there are no local projects
    if (!projectsToMigrate.length) {
      status = 'completed';
      return;
    }

    // @TODO There's a chance user's can't create projects in their personal organization. We should handle this case.
    // For each local project
    for (const localProject of projectsToMigrate) {
      // -- Create a remote project
      const newCloudProject = await window.main.insomniaFetch<{ id: string; name: string; organizationId: string }>({
        path: '/v1/organizations/personal/team-projects',
        method: 'POST',
        data: {
          name: localProject.name,
        },
        sessionId,
      });

      const project = await models.project.create({
        _id: newCloudProject.id,
        name: newCloudProject.name,
        remoteId: newCloudProject.organizationId,
      });

      // For each workspace in the local project
      const projectWorkspaces = (await database.find<Workspace>(models.workspace.type, {
        parentId: localProject._id,
      })).filter(workspace => !isScratchpad(workspace));

      for (const workspace of projectWorkspaces) {
        // Update the workspace to point to the newly created project
        await models.workspace.update(workspace, {
          parentId: project._id,
        });

        const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);

        // Initialize Sync on the workspace if it's not using Git sync
        try {
          if (!workspaceMeta.gitRepositoryId) {
            let vcs = getVCS();

            if (!vcs) {
              const driver = FileSystemDriver.create(
                process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
              );

              console.log('Initializing VCS');
              vcs = await initVCS(driver, async conflicts => {
                return new Promise((resolve, reject) => {
                  if (conflicts.length) {
                    reject('Not implemented');
                  }

                  resolve(conflicts);
                });
              });
            }
            invariant(vcs, 'VCS must be initialized');

            await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace });
            await pushSnapshotOnInitialize({ vcs, workspace, workspaceMeta, project });
          }
        } catch (e) {
          console.warn('Failed to initialize sync on workspace. This will be retried when the workspace is opened on the app.', e);
        }
      }

      // Delete the local project
      await models.project.remove(localProject);
    }

    status = 'completed';
  } catch (err) {
    console.warn('Failed to migrate projects to cloud', err);
  }
};
