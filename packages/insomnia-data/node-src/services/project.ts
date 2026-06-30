import type { Project, Query, RemoteProject } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

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
