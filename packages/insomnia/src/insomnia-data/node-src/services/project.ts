import type { Project } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.project;

export function create(patch: Partial<Project> = {}) {
  return db.docCreate<Project>(type, patch);
}

export function list(options?: { gitRepositoryIds?: string[]; organizationId?: string }) {
  const query: Record<string, unknown> = {};
  if (options?.organizationId) {
    query.parentId = options.organizationId;
  }
  if (options?.gitRepositoryIds) {
    query.gitRepositoryId = { $in: options.gitRepositoryIds };
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
      `Project not found: ${typeof idOrProject === 'string' ? idOrProject : idOrProject._id + idOrProject.name}`,
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
