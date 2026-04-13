import type { Project } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.project;

export function create(patch: Partial<Project> = {}) {
  return db.docCreate<Project>(type, patch);
}

export function getById(_id: string) {
  return db.findOne<Project>(type, { _id });
}

export function getByRemoteId(remoteId: string) {
  return db.findOne<Project>(type, { remoteId });
}

export function getAllByGitRepositoryIds(gitRepositoryIds: string[]) {
  return db.find<Project>(type, {
    gitRepositoryId: { $in: gitRepositoryIds },
  });
}

export function remove(project: Project) {
  return db.remove(project);
}

export function update(project: Project, patch: Partial<Project>) {
  return db.docUpdate(project, patch);
}

export async function all() {
  const projects = await db.find<Project>(type);
  return projects;
}
