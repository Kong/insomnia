// @flow
import type { Plugin } from '../index';
import * as models from '../../models';

export function init(plugin: Plugin) {
  return {
    store: {
      async hasItem(key: string): Promise<boolean> {
        const doc = await models.pluginData.getByKey(plugin.name, key);
        return doc !== null;
      },
      async setItem(key: string, value: string): Promise<void> {
        await models.pluginData.upsertByKey(plugin.name, key, String(value));
      },
      async getItem(key: string): Promise<string | null> {
        const doc = await models.pluginData.getByKey(plugin.name, key);
        return doc ? doc.value : null;
      },
      async removeItem(key: string): Promise<void> {
        await models.pluginData.removeByKey(plugin.name, key);
      },
      async clear(): Promise<void> {
        await models.pluginData.removeAll(plugin.name);
      },
      async all(): Promise<Array<{ key: string, value: string }>> {
        const docs = await models.pluginData.all(plugin.name);
        return docs.map(d => ({
          value: d.value,
          key: d.key,
        }));
      },
    },
  };
}
