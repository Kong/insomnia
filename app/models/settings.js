// @flow
import type {BaseModel} from './index';
import * as db from '../common/database';

type BaseSettings = {
  showPasswords: boolean,
  useBulkHeaderEditor: boolean,
  followRedirects: boolean,
  editorFontSize: number,
  editorIndentSize: number,
  editorLineWrapping: boolean,
  editorKeyMap: string,
  httpProxy: string,
  httpsProxy: string,
  noProxy: string,
  proxyEnabled: boolean,
  timeout: number,
  validateSSL: boolean,
  forceVerticalLayout: boolean,
  autoHideMenuBar: boolean,
  theme: string,
  maxRedirects: number,
  disableAnalyticsTracking: boolean,
  pluginPath: string,
  nunjucksPowerUserMode: boolean,
  deviceId: string | null
};

export type Settings = BaseModel & BaseSettings;

export const name = 'Settings';
export const type = 'Settings';
export const prefix = 'set';
export const canDuplicate = false;

export function init (): BaseSettings {
  return {
    showPasswords: false,
    useBulkHeaderEditor: false,
    followRedirects: true,
    editorFontSize: 11,
    editorIndentSize: 2,
    editorLineWrapping: true,
    editorKeyMap: 'default',
    httpProxy: '',
    httpsProxy: '',
    noProxy: '',
    maxRedirects: -1,
    proxyEnabled: false,
    timeout: 0,
    validateSSL: true,
    forceVerticalLayout: false,
    autoHideMenuBar: false,
    theme: 'default',
    disableAnalyticsTracking: false,
    pluginPath: '',
    nunjucksPowerUserMode: false,
    deviceId: null
  };
}

export function migrate (doc: Settings): Settings {
  return doc;
}

export async function all (patch: Object = {}): Promise<Array<Settings>> {
  const settings = await db.all(type);
  if (settings.length === 0) {
    return [await getOrCreate()];
  } else {
    return settings;
  }
}

export async function create (patch: Object = {}): Promise<Settings> {
  return db.docCreate(type, patch);
}

export async function update (settings: Settings, patch: Object): Promise<Settings> {
  return db.docUpdate(settings, patch);
}

export async function getOrCreate (patch: Object = {}): Promise<Settings> {
  const results = await db.all(type);
  if (results.length === 0) {
    return create(patch);
  } else {
    return results[0];
  }
}
