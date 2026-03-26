import type { BaseModel } from '~/models/types';

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

export const isPluginData = (model: Pick<BaseModel, 'type'>): model is PluginData => model.type === type;

export function init(): BasePluginData {
  return {
    plugin: '',
    key: '',
    value: '',
  };
}
