import { services } from 'insomnia-data';

import type { PluginStore } from '../../templating/types';
import type { Plugin } from '../types';

export function init(plugin: Pick<Plugin, 'name'>): { store: PluginStore } {
  return {
    store: {
      async hasItem(key: string) {
        const doc = await services.pluginData.getByKey(plugin.name, key);
        return doc !== undefined && doc !== null;
      },

      async setItem(key: string, value: string) {
        await services.pluginData.upsertByKey(plugin.name, key, String(value));
      },

      async getItem(key: string) {
        const doc = await services.pluginData.getByKey(plugin.name, key);
        return doc ? doc.value : null;
      },

      async removeItem(key: string) {
        await services.pluginData.removeByKey(plugin.name, key);
      },

      async clear() {
        await services.pluginData.removeAll(plugin.name);
      },

      async all(): Promise<
        {
          key: string;
          value: string;
        }[]
      > {
        const docs = (await services.pluginData.all(plugin.name)) || [];
        return docs.map(d => ({
          value: d.value,
          key: d.key,
        }));
      },
    },
  };
}
