import type { AllTypes, BaseModel } from 'insomnia-data';
import { models } from 'insomnia-data';
import { generateId, typedKeys } from 'insomnia-data/common';

import { migrate as migrateCookieJar } from './cookie-jar';
import { migrate as migrateRequest } from './request';
import { migrate as migrateResponse } from './response';
import { migrate as migrateSettings } from './settings';
import { migrate as migrateWorkspace } from './workspace';

export async function initModel<T extends BaseModel>(type: AllTypes, ...sources: Record<string, any>[]): Promise<T> {
  const model = models.getModel(type);

  if (!model) {
    const choices = models
      .all()
      .map(m => m.type)
      .join(', ');
    throw new Error(`Tried to init invalid model "${type}". Choices are ${choices}`);
  }

  // Define global default fields
  const objectDefaults = Object.assign(
    {},
    {
      _id: null,
      type: type,
      parentId: null,
      modified: Date.now(),
      created: Date.now(),
    },
    model.init(),
  );
  const fullObject = Object.assign({}, objectDefaults, ...sources);

  // Generate an _id if there isn't one yet
  if (!fullObject._id) {
    fullObject._id = generateId(model.prefix);
  }

  // Migrate the model
  // NOTE: Do migration before pruning because we might need to look at those fields
  let migratedDoc = fullObject;
  switch (type) {
    case 'CookieJar': {
      migratedDoc = migrateCookieJar(fullObject as never);
      break;
    }
    case 'Workspace': {
      migratedDoc = migrateWorkspace(fullObject as never);
      break;
    }
    case 'Request': {
      migratedDoc = migrateRequest(fullObject as never);
      break;
    }
    case 'Response': {
      migratedDoc = migrateResponse(fullObject as never);
      break;
    }
    case 'Settings': {
      migratedDoc = migrateSettings(fullObject as never);
      break;
    }
    default: {
      break;
    }
  }

  // optional keys do not generated in init method but should allow update.
  // If we put those keys in init method, all related models will show as modified in git sync.
  const modelOptionalKeys: string[] = 'optionalKeys' in model ? model.optionalKeys || [] : [];
  // Prune extra keys from doc
  for (const key of typedKeys(migratedDoc)) {
    if (!(key in objectDefaults) && !modelOptionalKeys.includes(key as string)) {
      delete migratedDoc[key];
    }
  }

  return migratedDoc as T;
}
