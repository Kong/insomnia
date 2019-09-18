// @flow
import * as packageJson from '../../package.json';
import type { BaseModel } from './index';
import * as db from '../common/database';
import { UPDATE_CHANNEL_STABLE } from '../common/constants';
import * as hotkeys from '../common/hotkeys';

type BaseSettings = {
  showPasswords: boolean,
  useBulkHeaderEditor: boolean,
  followRedirects: boolean,
  editorFontSize: number,
  editorIndentSize: number,
  editorLineWrapping: boolean,
  editorKeyMap: string,
  editorIndentWithTabs: boolean,
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
  maxHistoryResponses: number,
  pluginPath: string,
  nunjucksPowerUserMode: boolean,
  deviceId: string | null,
  updateChannel: string,
  updateAutomatically: boolean,
  disableUpdateNotification: boolean,
  environmentHighlightColorStyle: string,
  autocompleteDelay: number,
  fontMonospace: string | null,
  fontInterface: string | null,
  fontSize: number,
  fontVariantLigatures: boolean,
  maxTimelineDataSizeKB: number,

  // Feature flags
  enableSyncBeta: boolean,
  hotKeyRegistry: hotkeys.HotKeyRegistry,
};

export type Settings = BaseModel & BaseSettings;

export const name = 'Settings';
export const type = 'Settings';
export const prefix = 'set';
export const canDuplicate = false;
export const canSync = false;

export function init(): BaseSettings {
  return {
    showPasswords: false,
    useBulkHeaderEditor: false,
    followRedirects: true,
    editorFontSize: 11,
    editorIndentSize: 2,
    editorLineWrapping: true,
    editorKeyMap: 'default',
    editorIndentWithTabs: true,
    httpProxy: '',
    httpsProxy: '',
    noProxy: '',
    maxRedirects: -1,
    maxHistoryResponses: 20,
    proxyEnabled: false,
    timeout: 0,
    validateSSL: true,
    forceVerticalLayout: false,
    autoHideMenuBar: false,
    theme: packageJson.app.theme,
    pluginPath: '',
    nunjucksPowerUserMode: false,
    deviceId: null,
    updateChannel: UPDATE_CHANNEL_STABLE,
    updateAutomatically: true,
    disableUpdateNotification: false,
    environmentHighlightColorStyle: 'sidebar-indicator',
    autocompleteDelay: 1200,
    fontMonospace: null,
    fontInterface: null,
    fontSize: 13,
    fontVariantLigatures: false,
    maxTimelineDataSizeKB: 10,
    enableSyncBeta: false,
    hotKeyRegistry: hotkeys.newDefaultRegistry(),
  };
}

export function migrate(doc: Settings): Settings {
  doc = migrateEnsureHotKeys(doc);
  return doc;
}

export async function all(patch: Object = {}): Promise<Array<Settings>> {
  const settings = await db.all(type);
  if (settings.length === 0) {
    return [await getOrCreate()];
  } else {
    return settings;
  }
}

export async function create(patch: Object = {}): Promise<Settings> {
  return db.docCreate(type, patch);
}

export async function update(settings: Settings, patch: Object): Promise<Settings> {
  return db.docUpdate(settings, patch);
}

export async function getOrCreate(patch: Object = {}): Promise<Settings> {
  const results = await db.all(type);
  if (results.length === 0) {
    return create(patch);
  } else {
    return results[0];
  }
}

/**
 * Ensure map is updated when new hotkeys are added
 */
function migrateEnsureHotKeys(settings: Settings): Settings {
  settings.hotKeyRegistry = {
    ...hotkeys.newDefaultRegistry(),
    ...settings.hotKeyRegistry,
  };
  return settings;
}
