import type { PluginData } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.pluginData;

export function create(patch: Partial<PluginData> = {}) {
  return db.docCreate<PluginData>(type, patch);
}

export async function update(doc: PluginData, patch: Partial<PluginData>) {
  return db.docUpdate(doc, patch);
}

export async function upsertByKey(plugin: string, key: string, value: string) {
  const doc = await getByKey(plugin, key);
  return doc
    ? update(doc, {
        value,
      })
    : create({
        plugin,
        key,
        value,
      });
}

export async function removeByKey(plugin: string, key: string) {
  return db.removeWhere<PluginData>(type, { plugin, key });
}

export async function all(plugin: string) {
  return db.find<PluginData>(type, { plugin });
}

export async function removeAll(plugin: string) {
  return db.removeWhere<PluginData>(type, { plugin });
}

export async function getByKey(plugin: string, key: string) {
  return db.findOne<PluginData>(type, { plugin, key });
}
