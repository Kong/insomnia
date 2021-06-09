import { BaseModel, workspace } from '../../models';

// Keys for VCS to ignore when computing changes
const ALWAYS_IGNORED_KEYS = ['modified'];

const MODEL_IGNORED_KEYS: Record<string, string[]> = {
  [workspace.type]: ['parentId'],
};

const getModelIgnoredKeys = (type: string) => MODEL_IGNORED_KEYS[type] || [];

export const shouldIgnoreKey = (key: string, { type }: BaseModel) => {
  if (ALWAYS_IGNORED_KEYS.includes(key)) {
    return true;
  }

  if ((getModelIgnoredKeys(type)).includes(key)) {
    return true;
  }

  return false;
};

export const deleteIgnoredKeys = (doc: BaseModel) => {
  for (const key of ALWAYS_IGNORED_KEYS) {
    delete doc[key];
  }

  for (const key of getModelIgnoredKeys(doc.type)) {
    delete doc[key];
  }
};
