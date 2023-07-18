import { getCurrentSessionId } from '../../account/session';
import { database } from '../../common/database';
import * as models from '../../models';
import { isRemoteProject } from '../../models/project';
import { invariant } from '../../utils/invariant';

let status: 'idle' | 'pending' | 'error' | 'completed' = 'idle';

export const migrateLocalToCloudProjects = async () => {
  if (status !== 'idle') {
    return;
  }

  status = 'pending';
  try {
    const sessionId = getCurrentSessionId();
    invariant(sessionId, 'User must be logged in to migrate projects');

    // Get the personal Team
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

    const personalTeam = teams.find(team => team.isPersonal);

    const allProjects = await models.project.all();
    const workspaces = await models.workspace.all();

    const localProjects = allProjects.filter(p => !isRemoteProject(p));

    const bufferId = await database.bufferChanges();

    // Get the remote projects
    const teamProjects = await window.main.insomniaFetch<{
      data: {
        id: string;
        name: string;
      }[];
    }>({
      path: `/v1/teams/${personalTeam?.id}/team-projects`,
      method: 'GET',
      sessionId,
    });

    for (const project of localProjects) {
      let remoteProject = teamProjects.data.find(p => p.id === project._id);
      // Create the remote project if it doesn't exist
      if (!remoteProject) {
        const newRemoteProject = await window.main.insomniaFetch<{ id: string }>({
          path: `/v1/teams/${teams[0].id}/team-projects`,
          method: 'POST',
          data: {
            name: project.name,
          },
          sessionId,
        });

        remoteProject = {
          id: newRemoteProject.id,
          name: project.name,
        };
      }

      const projectWorkspaces = workspaces.filter(w => w.parentId === project._id);

      for (const workspace of projectWorkspaces) {
        workspace.parentId = remoteProject.id;
        models.workspace.update(workspace, workspace);
      }

      await models.project.remove(project);
    }

    await database.flushChanges(bufferId);
    status = 'completed';
  } catch (err) {
    console.warn('Failed to migrate projects to cloud', err);
    status = 'error';
  }
};
