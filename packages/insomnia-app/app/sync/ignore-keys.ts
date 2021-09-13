import { BaseModel } from '../models';
import { isWorkspace, Workspace } from '../models/workspace';

// Key for VCS to delete before computing changes
const DELETE_KEY: keyof BaseModel = 'modified';

type ResetModelKeys<T extends BaseModel> = {
  [K in keyof T]?: T[K] | null;
};

// Keys for VCS to reset before computing changes
//  We can't always delete keys
//  If we delete a key that previously existed (even as null), we then have a different hash because of the deletion
//  Therefore, we have to set it back to a default value
const RESET_WORKSPACE_KEYS: ResetModelKeys<Workspace> = {
  parentId: null,
};

export const shouldIgnoreKey = <T extends BaseModel>(key: keyof T, doc: T) => {
  if (key === DELETE_KEY) {
    return true;
  }

  if (isWorkspace(doc)) {
    return key in RESET_WORKSPACE_KEYS;
  }

  return false;
};

export const deleteKeys = <T extends BaseModel>(doc: T) => {
  // @ts-expect-error force delete the key even if it is required
  delete doc[DELETE_KEY];
};

export const resetKeys = <T extends BaseModel>(doc: T) => {
  if (isWorkspace(doc)) {
    Object.keys(RESET_WORKSPACE_KEYS)
      .forEach(key => {
        doc[key] = RESET_WORKSPACE_KEYS[key];
      });
  }
};
