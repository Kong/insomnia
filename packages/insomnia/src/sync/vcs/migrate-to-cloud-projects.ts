import { StringDecoder } from 'string_decoder';

import { getCurrentSessionId } from '../../account/session';
import { database } from '../../common/database';
import * as models from '../../models';
import { isRemoteProject } from '../../models/project';
import { Workspace } from '../../models/workspace';
import { invariant } from '../../utils/invariant';
import { pushSnapshotOnInitialize } from './initialize-backend-project';
import { getVCS } from './vcs';

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
    const localProjects = allProjects.filter(p => !isRemoteProject(p));

    // Nothing to migrate if there are no local projects
    if (!localProjects.length) {
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
    for (const project of localProjects) {
      // -- Create a remote project
      const remoteProject = await window.main.insomniaFetch<{ id: string; name: StringDecoder }>({
        path: `/v1/teams/${personalTeam.id}/team-projects`,
        method: 'POST',
        data: {
          name: project.name,
        },
        sessionId,
      });

      // For each workspace in the project
      const projectWorkspaces = await database.find<Workspace>(models.workspace.type, {
        parentId: project._id,
      });

      for (const workspace of projectWorkspaces) {
        // Update the workspace to point to the newly created project
        await models.workspace.update(workspace, {
          parentId: remoteProject.id,
        });

        const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
        const vcs = getVCS();
        invariant(vcs, 'VCS must be initialized');
        // Initialize Sync on the workspace
        await pushSnapshotOnInitialize({ vcs, workspace, workspaceMeta, project });
      }

      // Delete the local project
      await models.project.remove(project);
    }

    status = 'completed';
  } catch (err) {
    console.warn('Failed to migrate projects to cloud', err);
  }
};
