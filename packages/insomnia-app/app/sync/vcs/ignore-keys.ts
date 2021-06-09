import { BaseModel, workspace } from '../../models';

// Keys for VCS to ignore when computing changes
const ALWAYS_IGNORED_KEYS = ['modified'];

const MODEL_IGNORED_KEYS: Record<string, {key: string; defaultValue: any}[]> = {
  [workspace.type]: [{ key: 'parentId', defaultValue: null }],
};

const getModelIgnoredKeys = (type: string) => MODEL_IGNORED_KEYS[type] || [];

export const shouldIgnoreKey = (key: string, { type }: BaseModel) => {
  if (ALWAYS_IGNORED_KEYS.includes(key)) {
    return true;
  }

  if ((getModelIgnoredKeys(type)).find(entry => entry.key === key)) {
    return true;
  }

  return false;
};

export const clearIgnoredKeys = (doc: BaseModel) => {
  for (const key of ALWAYS_IGNORED_KEYS) {
    delete doc[key];
  }

  for (const { key, defaultValue } of getModelIgnoredKeys(doc.type)) {
    // If we delete the key, we then have a different hash because of the deletion
    // We have to not delete the key, but set it back to it's default value
    doc[key] = defaultValue;
  }
};
