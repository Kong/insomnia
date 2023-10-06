import { database as db } from '../common/database';
import { generateId } from '../common/misc';
import { type BaseModel } from './index';

export const name = 'Project';
export const type = 'Project';
export const prefix = 'proj';
export const canDuplicate = false;
export const canSync = false;

export const SCRATCHPAD_PROJECT_ID = `${prefix}_scratchpad`;

export const isScratchpadProject = (project: Pick<Project, '_id'>) => project._id === SCRATCHPAD_PROJECT_ID;
export const isLocalProject = (project: Pick<Project, 'remoteId'>): project is LocalProject => project.remoteId === null;
export const isRemoteProject = (project: Pick<Project, 'remoteId'>): project is RemoteProject => !isLocalProject(project);
export const projectHasSettings = (project: Pick<Project, '_id'>) => !isScratchpadProject(project);

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
  return projects;
}

export function isDefaultOrganizationProject(project: Project) {
  // legacy remoteId = proj_team_xxx
  // new remoteId = proj_org_xxx
  return project.remoteId?.startsWith('proj_team') || project.remoteId?.startsWith('proj_org');
}
