import * as models from '../../models';
import type { Plugin } from '../index';

export interface PluginStore {
  hasItem(arg0: string): Promise<boolean>;
  setItem(arg0: string, arg1: string): Promise<void>;
  getItem(arg0: string): Promise<string | null>;
  removeItem(arg0: string): Promise<void>;
  clear(): Promise<void>;
  all(): Promise<
    {
      key: string;
      value: string;
    }[]
  >;
}

export function init(plugin: Plugin):{store: PluginStore} {
  return {
    store: {
      async hasItem(key: string) {
        const doc = await models.pluginData.getByKey(plugin.name, key);
        return doc !== null;
      },

      async setItem(key: string, value: string) {
        await models.pluginData.upsertByKey(plugin.name, key, String(value));
      },

      async getItem(key: string) {
        const doc = await models.pluginData.getByKey(plugin.name, key);
        return doc ? doc.value : null;
      },

      async removeItem(key: string) {
        await models.pluginData.removeByKey(plugin.name, key);
      },

      async clear() {
        await models.pluginData.removeAll(plugin.name);
      },

      async all(): Promise<
        {
          key: string;
          value: string;
        }[]
        > {
        const docs = await models.pluginData.all(plugin.name) || [];
        return docs.map(d => ({
          value: d.value,
          key: d.key,
        }));
      },
    },
  };
}
