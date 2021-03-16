// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';

export const name = 'PluginData';
export const type = 'PluginData';
export const prefix = 'plg';
export const canDuplicate = false;
export const canSync = false;

type BasePluginData = {
  plugin: string,
  key: string,
  value: string,
};

export type PluginData = BaseModel & BasePluginData;

export function init(): BasePluginData {
  return {
    plugin: '',
    key: '',
    value: '',
  };
}

export function migrate(doc: PluginData): PluginData {
  return doc;
}

export function create(patch: $Shape<PluginData> = {}): Promise<PluginData> {
  return db.docCreate(type, patch);
}

export async function update(doc: PluginData, patch: $Shape<PluginData>): Promise<PluginData> {
  return db.docUpdate(doc, patch);
}

export async function upsertByKey(plugin: string, key: string, value: string): Promise<PluginData> {
  const doc = await getByKey(plugin, key);
  return doc ? update(doc, { value }) : create({ plugin, key, value });
}

export async function removeByKey(plugin: string, key: string): Promise<void> {
  return db.removeWhere(type, { plugin, key });
}

export async function all(plugin: string): Promise<Array<PluginData>> {
  return db.find(type, { plugin });
}

export async function removeAll(plugin: string): Promise<void> {
  return db.removeWhere(type, { plugin });
}

export async function getByKey(plugin: string, key: string): Promise<PluginData | null> {
  return db.getWhere(type, { plugin, key });
}
