import { getAccountId, getCurrentSessionId } from '../../account/session';
import { database } from '../../common/database';
import * as models from '../../models';
import { isOwnerOfOrganization, isPersonalOrganization } from '../../models/organization';
import { Project, RemoteProject } from '../../models/project';
import { OrganizationsResponse } from '../../ui/routes/organization';
import { invariant } from '../../utils/invariant';

let status: 'idle' | 'pending' | 'error' | 'completed' = 'idle';

// TODO:
// Error handling and return type for errors

// Migration:
// Team ~= Project > Workspaces
// In the previous API: { _id: 'proj_team_123', remoteId: 'team_123', parentId: null }

// Organization > TeamProject > Workspaces
// In the new API: { _id: 'proj_team_123', remoteId: 'proj_team_123', parentId: 'team_123' }

export const shouldMigrateProjectUnderOrganization = async () => {
  const localProjectCount = await database.count<Project>(models.project.type, {
    remoteId: null,
    parentId: null,
    _id: { $ne: models.project.SCRATCHPAD_PROJECT_ID },
  });

  const legacyRemoteProjectCount = await database.count<RemoteProject>(models.project.type, {
    remoteId: { $ne: null },
    parentId: null,
  });

  return localProjectCount > 0 || legacyRemoteProjectCount > 0;
};

export const migrateProjectsIntoOrganization = async () => {
  if (status !== 'idle' && status !== 'error') {
    return;
  }

  status = 'pending';

  try {
    const sessionId = getCurrentSessionId();
    invariant(sessionId, 'User must be logged in to migrate projects');

    // local projects what if they dont have a parentId?
    // after migration: all projects have a parentId

    // no more hostage projects
    // when will we know what org is you have?
    // already migrated: all things are globes
    // already migrated with a blank account what happens to previous account data?
    // go to whatever

    // about to migrate: have one or more projects without parentIds/null
    // if the project doesn't have remoteId we can throw in the home org
    // if the project has a remoteId, and is in the org, we know it should have org as a parentId
    // if the project has a remoteId, and is not in my logged in org
    // go to the whatever

    // whatever
    // export all
    // 1. show a alert describing the state of the orphaned projects and instructing export all and reimport
    // 2. show a recovery ux to move old workspaces into existing projects
    // 3. show orphaned projects in the home organization
    // 4. show disabled orgs in the sidebar from previous account where you can see the data

    // todo
    // 1. [x] only assign parentIds and migrate old remote logic
    // 2. count orphaned projects
    // 3. decide which approach take for orphaned projects
    // 4. decide if theres no reason to keep migrateCollectionsIntoRemoteProject

    // assign remote project parentIds to new organization structure
    // the remote id field used to track team_id (remote concept for matching 1:1 with this project) which is now org_id
    // the _id field used to track the proj_team_id which was a wrapper for the team_id prefixing proj_to the above id,
    // which is now the remoteId for tracking the projects within an org
    const legacyRemoteProjects = await database.find<RemoteProject>(models.project.type, {
      remoteId: { $ne: null },
      parentId: null,
    });
    for (const remoteProject of legacyRemoteProjects) {
      await models.project.update(remoteProject, {
        parentId: remoteProject.remoteId,
        remoteId: remoteProject._id,
      });
    }

    // Local projects without organizations except scratchpad
    const localProjects = await database.find<Project>(models.project.type, {
      remoteId: null,
      parentId: null,
      _id: { $ne: models.project.SCRATCHPAD_PROJECT_ID },
    });
    const organizationsResult = await window.main.insomniaFetch<OrganizationsResponse | void>({
      method: 'GET',
      path: '/v1/organizations',
      sessionId,
    });
    const accountId = getAccountId();
    invariant(organizationsResult, 'Failed to fetch organizations');
    invariant(accountId, 'Failed to get account id');
    const { organizations } = organizationsResult;
    const personalOrganization = organizations.filter(isPersonalOrganization)
      .find(organization =>
        isOwnerOfOrganization({
          organization,
          accountId,
        }));
    invariant(personalOrganization, 'Failed to find personal organization');

    for (const localProject of localProjects) {
      await models.project.update(localProject, {
        parentId: personalOrganization.id,
      });
    }

    status = 'completed';
  } catch (err) {
    console.warn('Failed to migrate projects to personal workspace', err);
    throw err;
  }
};
