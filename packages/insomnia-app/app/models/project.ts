import { getAppName } from '../common/constants';
import { database as db } from '../common/database';
import { generateId } from '../common/misc';
import type { BaseModel } from './index';

export const name = 'Project';
export const type = 'Project';
export const prefix = 'proj';
export const canDuplicate = false;
export const canSync = false;

export const DEFAULT_PROJECT_ID = `${prefix}_default-project`;

export const isDefaultProject = (project: Pick<Project, '_id'>) => project._id === DEFAULT_PROJECT_ID;
export const isNotDefaultProject = (project: Pick<Project, '_id'>) => !isDefaultProject(project);
export const isLocalProject = (project: Pick<Project, 'remoteId'>): project is LocalProject => project.remoteId === null;
export const isRemoteProject = (project: Pick<Project, 'remoteId'>): project is RemoteProject => !isLocalProject(project);
export const projectHasSettings = (project: Pick<Project, '_id'>) => !isDefaultProject(project);

interface CommonProject {
  name: string;
}

export interface RemoteProject extends BaseModel, CommonProject {
  remoteId: string;
}

export interface LocalProject extends BaseModel, CommonProject {
  remoteId: null;
}

export type Project = LocalProject | RemoteProject;

export const isProject = (model: Pick<BaseModel, 'type'>): model is Project => (
  model.type === type
);

export const isProjectId = (id: string | null) => (
  id?.startsWith(`${prefix}_`)
);

export function init(): Partial<Project> {
  return {
    name: 'My Project',
    remoteId: null, // `null` is necessary for the model init logic to work properly
  };
}

export function migrate(project: Project) {
  return project;
}

export function createId() {
  return generateId(prefix);
}

export function create(patch: Partial<Project> = {}) {
  return db.docCreate<Project>(type, patch);
}

export function getById(_id: string) {
  return db.getWhere<Project>(type, { _id });
}

export function getByRemoteId(remoteId: string) {
  return db.getWhere<Project>(type, { remoteId });
}

export function remove(project: Project) {
  return db.remove(project);
}

export function update(project: Project, patch: Partial<Project>) {
  return db.docUpdate(project, patch);
}

export async function all() {
  const projects = await db.all<Project>(type);

  if (!projects.find(c => c._id === DEFAULT_PROJECT_ID)) {
    await create({ _id: DEFAULT_PROJECT_ID, name: getAppName(), remoteId: null });
    return db.all<Project>(type);
  }

  return projects;
}
