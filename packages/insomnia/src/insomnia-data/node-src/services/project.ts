import { createTeamProject, fetchTeamProjects } from 'insomnia-api';

import type { Project, Query, RemoteProject } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

import { get as getUser } from './user-session';
import type { SyncVCSLike } from './vcs';
import { commitAllAndPush, getWorkspacesOfProject, hasGitRepositoryId } from './workspace';

const { type } = models.project;

export function create(patch: Partial<Project> = {}) {
  return db.docCreate<Project>(type, patch);
}

export function list(options?: { gitRepositoryIds?: string[]; organizationId?: string }) {
  const query: Query<Project> = {};
  if (options?.organizationId) {
    query.parentId = options.organizationId;
  }
  if (options?.gitRepositoryIds) {
    const queryIds = options.gitRepositoryIds.flatMap(id => models.project.getQueryableGitRepositoryIds(id));
    query.gitRepositoryId = { $in: queryIds };
  }
  return db.find<Project>(type, query);
}

export function get(id: string) {
  return db.findOne<Project>(type, { _id: id });
}

export function getByRemoteId(remoteId: string) {
  return db.findOne<Project>(type, { remoteId });
}

const getProjectByIdOrProject = async (idOrProject: string | Project) => {
  const project = typeof idOrProject === 'string' ? await get(idOrProject) : idOrProject;
  if (!project) {
    throw new Error(
      `Project not found: ${typeof idOrProject === 'string' ? idOrProject : `_id=${idOrProject._id}, name=${idOrProject.name}`}`,
    );
  }
  return project;
};

export async function update(idOrProject: string | Project, patch: Partial<Project>) {
  const project = await getProjectByIdOrProject(idOrProject);
  return db.docUpdate(project, patch);
}

export async function remove(idOrProject: string | Project) {
  const project = await getProjectByIdOrProject(idOrProject);
  return db.remove(project);
}

export async function getFirstProjectUnderOrg(organizationId: string) {
  return db.findOne<Project>(type, { parentId: organizationId });
}

interface TeamProject {
  id: string;
  name: string;
}

export async function syncProjectsWithBackend(teamProjects: TeamProject[], organizationId: string) {
  // assumption: api teamProjects is the source of truth for migrated projects
  // once migrated orgs become the source of truth for projects
  // its important that migration be completed before this code is run
  const existingRemoteProjects = await db.find<Project>(type, {
    remoteId: { $in: teamProjects.map(p => p.id) },
  });

  const existingRemoteProjectsRemoteIds = existingRemoteProjects.map(p => p.remoteId);
  const remoteProjectsThatNeedToBeCreated = teamProjects.filter(p => !existingRemoteProjectsRemoteIds.includes(p.id));

  // this will create a new project for any remote projects that don't exist in the current organization
  await Promise.all(
    remoteProjectsThatNeedToBeCreated.map(async prj => {
      await create({
        remoteId: prj.id,
        name: prj.name,
        parentId: organizationId,
      });
    }),
  );

  const remoteProjectsThatNeedToBeUpdated = await db.find<Project>(type, {
    // Remote ID is in the list of remote projects
    remoteId: { $in: teamProjects.map(p => p.id) },
  });

  await Promise.all(
    remoteProjectsThatNeedToBeUpdated.map(async prj => {
      const remoteProject = teamProjects.find(p => p.id === prj.remoteId);
      if (remoteProject && remoteProject.name !== prj.name) {
        await update(prj, {
          name: remoteProject.name,
        });
      }
    }),
  );

  // Turn remote projects from the current organization that are not in the list of remote projects into local projects.
  const removedRemoteProjects = await db.find<Project>(type, {
    // filter by this organization so no legacy data can be accidentally removed, because legacy had null parentId
    parentId: organizationId,
    // Remote ID is not in the list of remote projects.
    // add `$ne: null` condition because if remoteId is already null, we dont need to remove it again.
    // nedb use append-only format, all updates and deletes actually result in lines added
    remoteId: {
      $nin: teamProjects.map(p => p.id),
      $ne: null,
    },
  });

  await Promise.all(
    removedRemoteProjects.map(async prj => {
      await update(prj, {
        remoteId: null,
      });
    }),
  );
}

export async function migrateProjectsIntoOrganization(personalOrganizationId: string) {
  // Legacy remote projects without organizations
  // Local projects without organizations except scratchpad
  const [legacyRemoteProjects, localProjects] = await Promise.all([
    db.find<RemoteProject>(models.project.type, {
      remoteId: { $ne: null },
      parentId: null,
    }),
    db.find<Project>(models.project.type, {
      remoteId: null,
      parentId: null,
      _id: { $ne: models.project.SCRATCHPAD_PROJECT_ID },
    }),
  ]);

  const updatePromises = [];
  // Legacy remoteId should be orgId and legacy _id should be remoteId
  for (const remoteProject of legacyRemoteProjects) {
    updatePromises.push(
      update(remoteProject, {
        parentId: remoteProject.remoteId,
        remoteId: remoteProject._id,
      }),
    );
  }

  // Assign all local projects to personal organization
  for (const localProject of localProjects) {
    updatePromises.push(
      update(localProject, {
        parentId: personalOrganizationId,
      }),
    );
  }

  await Promise.all(updatePromises);
}

// Migration:
// Team ~= Project > Workspaces
// In the previous API: { _id: 'proj_team_123', remoteId: 'team_123', parentId: null }

// Organization > TeamProject > Workspaces
// In the new API: { _id: 'proj_team_123', remoteId: 'proj_team_123', parentId: 'team_123' }

// the remote id field previously tracked "team_id"
// (remote concept for matching 1:1 with this project) which is now org_id
// the _id field previously tracked the "proj_team_id"
// which was a wrapper for the team_id prefixing proj_to the above id,
// which is now the remoteId for tracking the projects within an org
export async function hasProjectsToMigrate() {
  const [localProjectCount, legacyRemoteProjectCount] = await Promise.all([
    db.count<Project>(models.project.type, {
      remoteId: null,
      parentId: null,
    }),
    db.count<Project>(models.project.type, {
      remoteId: { $ne: null },
      parentId: null,
    }),
  ]);

  return localProjectCount > 0 || legacyRemoteProjectCount > 0;
}

export async function getLocalProjectsOfOrg(orgId: string) {
  return await db.find<Project>(models.project.type, {
    parentId: orgId,
    remoteId: null,
  });
}

export async function pushLocalProject({
  project,
  vcs,
  organizationId,
}: {
  project: Project;
  vcs: SyncVCSLike;
  organizationId: string;
}) {
  const { id: sessionId } = await getUser();
  const newCloudProject = await createTeamProject({
    sessionId,
    organizationId,
    name: project.name,
  });
  const updatedProject = await update(project, {
    name: newCloudProject.name,
    remoteId: newCloudProject.id,
  });

  // For each workspace in the local project
  const projectWorkspaces = await getWorkspacesOfProject(updatedProject._id);

  for (const workspace of projectWorkspaces) {
    const hasGitRepoId = await hasGitRepositoryId(workspace);

    // Initialize Sync on the workspace if it's not using Git sync
    try {
      if (!hasGitRepoId) {
        if (!vcs) {
          throw new Error('VCS must be initialized');
        }

        await vcs.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);
        await commitAllAndPush({ workspace, vcs, message: 'Initial Snapshot', project: updatedProject });
      }
    } catch (e) {
      console.warn(
        'Failed to initialize sync on workspace. This will be retried when the workspace is opened on the app.',
        e,
      );
      // TODO: here we should show the try again dialog
    }
  }
}

export async function getAllTeamProjects(organizationId: string) {
  const { id: sessionId } = await getUser();
  if (!sessionId) {
    return [];
  }

  console.log('[project] Fetching', organizationId);
  const response = await fetchTeamProjects({ sessionId, organizationId });
  return response.data;
}

export async function migrateProjectsUnderOrganization(
  orgId: string,
  preferredProjectType: string | null,
  vcs: SyncVCSLike,
) {
  if (await hasProjectsToMigrate()) {
    await migrateProjectsIntoOrganization(orgId);

    if (preferredProjectType === 'remote') {
      const localProjects = await getLocalProjectsOfOrg(orgId);

      // If any of those fail projects will still be under the organization as local projects
      for (const project of localProjects) {
        try {
          await pushLocalProject({
            project,
            organizationId: orgId,
            vcs,
          });
        } catch {
          console.log(`Failed to push project ${project._id} to the cloud`);
        }
      }
    }
  }
}
