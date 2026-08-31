import { fetchTeamProjects } from 'insomnia-api';
import type { Project, Query, RemoteProject } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

import * as userSessionService from './user-session';

const { type } = models.project;

export function create(patch: Partial<Project> = {}) {
  return db.docCreate<Project>(type, patch);
}

export function list(query?: Query<Project>, sort?: Record<string, any>, limit?: number) {
  return db.find<Project>(type, query, sort, limit);
}

export function count(query?: Query<Project>) {
  return db.count<Project>(type, query);
}

export function get(query?: Query<Project>, sort?: Record<string, any>) {
  return db.findOne<Project>(type, query, sort);
}

const _getProjectByIdOrProject = async (idOrProject: string | Project) => {
  const project = typeof idOrProject === 'string' ? await getById(idOrProject) : idOrProject;
  if (!project) {
    throw new Error(
      `Project not found: ${typeof idOrProject === 'string' ? idOrProject : `_id=${idOrProject._id}, name=${idOrProject.name}`}`,
    );
  }
  return project;
};

export async function update(idOrProject: string | Project, patch: Partial<Project>) {
  const project = await _getProjectByIdOrProject(idOrProject);
  return db.docUpdate(project, patch);
}

export async function remove(idOrProject: string | Project) {
  const project = await _getProjectByIdOrProject(idOrProject);
  return db.remove(project);
}

export function getById(id: string) {
  return get({ _id: id });
}

export function getByRemoteId(remoteId: string) {
  return get({ remoteId }) as Promise<RemoteProject | null>;
}

export function listByOrganizationIds(organizationIds: string | string[]) {
  const ids = Array.isArray(organizationIds) ? organizationIds : [organizationIds];
  return list({
    parentId: ids.length === 1 ? ids[0] : { $in: ids },
  });
}

export function listByGitRepositoryIds(gitRepositoryIds: string | string[]) {
  const ids = Array.isArray(gitRepositoryIds) ? gitRepositoryIds : [gitRepositoryIds];
  const queryIds = ids.flatMap(id => models.project.getQueryableGitRepositoryIds(id));
  return list({ gitRepositoryId: { $in: queryIds } });
}

export async function getFirstProjectOfOrganization(organizationId: string) {
  return db.findOne<Project>(type, { parentId: organizationId });
}

export async function getAllTeamProjects(organizationId: string) {
  const { id: sessionId } = await userSessionService.get();
  if (!sessionId) {
    return [];
  }

  console.log('[project] Fetching', organizationId);
  const response = await fetchTeamProjects({ sessionId, organizationId });
  return response.data;
}

interface TeamProject {
  id: string;
  name: string;
}

export async function syncTeamProjects({
  organizationId,
  teamProjects,
}: {
  teamProjects: TeamProject[];
  organizationId: string;
}) {
  // assumption: api teamProjects is the source of truth for migrated projects
  // once migrated orgs become the source of truth for projects
  // its important that migration be completed before this code is run
  const existingRemoteProjects = await list({
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

  const remoteProjectsThatNeedToBeUpdated = await list({
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
  const removedRemoteProjects = await list({
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

export async function syncProjects(organizationId: string) {
  const user = await userSessionService.get();
  const teamProjects = await getAllTeamProjects(organizationId);
  // ensure we don't sync projects in the wrong place
  if (Array.isArray(teamProjects) && user.id && !models.organization.isScratchpadOrganizationId(organizationId)) {
    await syncTeamProjects({ teamProjects, organizationId });
  }
}
