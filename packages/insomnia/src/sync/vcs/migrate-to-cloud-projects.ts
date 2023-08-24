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

    // Fetch the user's personal Team
    const teams = await window.main.insomniaFetch<{
      created: string;
      id: string;
      ownerAccountId: string;
      name: string;
      isPersonal: boolean;
      accounts: {
        firstName: string;
        lastName: string;
        email: string;
        id: string;
        isAdmin: boolean;
        dateAccepted: string;
      }[];
    }[]>({
      method: 'GET',
      path: '/api/teams',
      sessionId,
    });

    console.log({
      teams,
    });

    const personalTeam = teams.find(team => team.isPersonal);
    invariant(personalTeam, 'Could not find personal Team');

    // For each local project
    for (const localProject of projectsToMigrate) {
      // -- Create a remote project
      const newCloudProject = await window.main.insomniaFetch<{ id: string; name: string }>({
        path: `/v1/teams/${personalTeam.id}/team-projects`,
        method: 'POST',
        data: {
          name: localProject.name,
        },
        sessionId,
      });

      const project = await models.project.create({
        _id: newCloudProject.id,
        name: newCloudProject.name,
        remoteId: newCloudProject.id,
        parentId: personalTeam.id,
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
      }

      // Delete the local project
      await models.project.remove(localProject);
    }

    status = 'completed';
  } catch (err) {
    console.warn('Failed to migrate projects to cloud', err);
  }
};
