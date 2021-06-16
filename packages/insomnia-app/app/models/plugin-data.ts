import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'PluginData';

export const type = 'PluginData';

export const prefix = 'plg';

export const canDuplicate = false;

export const canSync = false;

interface BasePluginData {
  plugin: string;
  key: string;
  value: string;
}

export type PluginData = BaseModel & BasePluginData;

export const isPluginData = (model: Pick<BaseModel, 'type'>): model is PluginData => (
  model.type === type
);

export function init(): BasePluginData {
  return {
    plugin: '',
    key: '',
    value: '',
  };
}

export function migrate(doc: PluginData) {
  return doc;
}

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
  return db.removeWhere(type, { plugin, key });
}

export async function all(plugin: string) {
  return db.find<PluginData>(type, { plugin });
}

export async function removeAll(plugin: string) {
  return db.removeWhere(type, { plugin });
}

export async function getByKey(plugin: string, key: string) {
  return db.getWhere<PluginData>(type, { plugin, key });
}
