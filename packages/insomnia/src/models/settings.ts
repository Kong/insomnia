import { databaseSchema } from '~/models/schema';

import { database as db } from '../common/database';
import { type Settings as BaseSettings } from '../common/settings';
import type { BaseModel } from './index';

export type Settings = BaseModel & BaseSettings;
const type = databaseSchema.Settings.type;

export type ThemeSettings = Pick<Settings, 'autoDetectColorScheme' | 'lightTheme' | 'darkTheme' | 'theme'>;

export const isSettings = (model: Pick<BaseModel, 'type'>): model is Settings => model.type === type;

// force vertical layout for playwright tests to avoid horizontal scrolling issues

export async function all() {
  let settingsList = await db.find<Settings>(type);

  if (settingsList?.length === 0) {
    settingsList = [await getOrCreate()];
  }

  return settingsList;
}

async function create() {
  const settings = await db.docCreate<Settings>(type);
  return settings;
}

export async function update(settings: Settings, patch: Partial<Settings>) {
  const updatedSettings = await db.docUpdate<Settings>(settings, patch);
  return updatedSettings;
}

export async function patch(settingsPatch: Partial<Settings>) {
  const settings = await getOrCreate();
  const updatedSettings = await db.docUpdate<Settings>(settings, settingsPatch);
  return updatedSettings;
}

export async function getOrCreate() {
  const result = await db.findOne<Settings>(type);

  if (!result) {
    return await create();
  }
  return result;
}

export async function get() {
  return getOrCreate();
}
