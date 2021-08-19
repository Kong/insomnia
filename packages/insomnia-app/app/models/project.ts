import { getAppName } from '../common/constants';
import { database as db } from '../common/database';
import { generateId } from '../common/misc';
import type { BaseModel } from './index';

export const name = 'Space';
export const type = 'Space';
export const prefix = 'proj';
export const canDuplicate = false;
export const canSync = false;

export const BASE_PROJECT_ID = `${prefix}_base-space`;

export const isBaseProject = (project: Space) => project._id === BASE_PROJECT_ID;
export const isNotBaseProject = (project: Space) => !isBaseProject(project);
export const isLocalProject = (project: Space): project is LocalSpace => project.remoteId === null;
export const isRemoteProject = (project: Space): project is RemoteSpace => !isLocalProject(project);
export const projectHasSettings = (project: Space) => !isBaseProject(project);

interface CommonSpace {
  name: string;
}

export interface RemoteSpace extends BaseModel, CommonSpace {
  remoteId: string;
}

export interface LocalSpace extends BaseModel, CommonSpace {
  remoteId: null;
}

export type Space = LocalSpace | RemoteSpace;

export const isProject = (model: Pick<BaseModel, 'type'>): model is Space => (
  model.type === type
);

export const isProjectId = (id: string | null) => (
  id?.startsWith(`${prefix}_`)
);

export function init(): Partial<Space> {
  return {
    name: 'My Space',
    remoteId: null, // `null` is necessary for the model init logic to work properly
  };
}

export function migrate(project: Space) {
  return project;
}

export function createId() {
  return generateId(prefix);
}

export function create(patch: Partial<Space> = {}) {
  return db.docCreate<Space>(type, patch);
}

export function getById(_id: string) {
  return db.getWhere<Space>(type, { _id });
}

export function getByRemoteId(remoteId: string) {
  return db.getWhere<Space>(type, { remoteId });
}

export function remove(project: Space) {
  return db.remove(project);
}

export function update(project: Space, patch: Partial<Space>) {
  return db.docUpdate(project, patch);
}

export async function all() {
  const projects = await db.all<Space>(type);

  if (!projects.find(c => c._id === BASE_PROJECT_ID)) {
    await create({ _id: BASE_PROJECT_ID, name: getAppName(), remoteId: null });
    return db.all<Space>(type);
  }

  return projects;
}
