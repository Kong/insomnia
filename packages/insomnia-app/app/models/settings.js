// @flow
import * as packageJson from '../../package.json';
import type { BaseModel } from './index';
import * as db from '../common/database';
import { UPDATE_CHANNEL_STABLE } from '../common/constants';
import * as hotkeys from '../common/hotkeys';

type BaseSettings = {
  autoHideMenuBar: boolean,
  autocompleteDelay: number,
  deviceId: string | null,
  disableHtmlPreviewJs: boolean,
  disableUpdateNotification: boolean,
  editorFontSize: number,
  editorIndentSize: number,
  editorIndentWithTabs: boolean,
  editorKeyMap: string,
  editorLineWrapping: boolean,
  environmentHighlightColorStyle: string,
  followRedirects: boolean,
  fontInterface: string | null,
  fontMonospace: string | null,
  fontSize: number,
  fontVariantLigatures: boolean,
  forceVerticalLayout: boolean,
  hotKeyRegistry: hotkeys.HotKeyRegistry,
  httpProxy: string,
  httpsProxy: string,
  maxHistoryResponses: number,
  maxRedirects: number,
  maxTimelineDataSizeKB: number,
  noProxy: string,
  nunjucksPowerUserMode: boolean,
  pluginPath: string,
  proxyEnabled: boolean,
  showPasswords: boolean,
  theme: string,
  timeout: number,
  updateAutomatically: boolean,
  updateChannel: string,
  useBulkHeaderEditor: boolean,
  useBulkParametersEditor: boolean,
  validateSSL: boolean,

  // Feature flags
  enableSyncBeta: boolean,
};

export type Settings = BaseModel & BaseSettings;

export const name = 'Settings';
export const type = 'Settings';
export const prefix = 'set';
export const canDuplicate = false;
export const canSync = false;

export function init(): BaseSettings {
  return {
    autoHideMenuBar: false,
    autocompleteDelay: 1200,
    deviceId: null,
    disableHtmlPreviewJs: false,
    disableUpdateNotification: false,
    editorFontSize: 11,
    editorIndentSize: 2,
    editorIndentWithTabs: true,
    editorKeyMap: 'default',
    editorLineWrapping: true,
    environmentHighlightColorStyle: 'sidebar-indicator',
    followRedirects: true,
    fontInterface: null,
    fontMonospace: null,
    fontSize: 13,
    fontVariantLigatures: false,
    forceVerticalLayout: false,
    hotKeyRegistry: hotkeys.newDefaultRegistry(),
    httpProxy: '',
    httpsProxy: '',
    maxHistoryResponses: 20,
    maxRedirects: -1,
    maxTimelineDataSizeKB: 10,
    noProxy: '',
    nunjucksPowerUserMode: false,
    pluginPath: '',
    proxyEnabled: false,
    showPasswords: false,
    theme: packageJson.app.theme,
    timeout: 0,
    updateAutomatically: true,
    updateChannel: UPDATE_CHANNEL_STABLE,
    useBulkHeaderEditor: false,
    useBulkParametersEditor: false,
    validateSSL: true,

    // Feature flags
    enableSyncBeta: false,
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
