import { database as db, models, type Settings } from '~/insomnia-data';

const { type } = models.settings;

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
