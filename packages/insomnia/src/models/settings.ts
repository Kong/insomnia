import {
  getAppDefaultDarkTheme,
  getAppDefaultLightTheme,
  getAppDefaultTheme,
} from '../common/constants';
import { database as db } from '../common/database';
import * as hotkeys from '../common/hotkeys';
import { HttpVersions, type KeyboardShortcut, type Settings as BaseSettings, UpdateChannel } from '../common/settings';
import type { BaseModel } from './index';

export type Settings = BaseModel & BaseSettings;
export const name = 'Settings';
export const type = 'Settings';
export const prefix = 'set';
export const canDuplicate = false;
export const canSync = false;

export type ThemeSettings = Pick<Settings, 'autoDetectColorScheme' | 'lightTheme' | 'darkTheme' | 'theme'>;

export const isSettings = (model: Pick<BaseModel, 'type'>): model is Settings => (
  model.type === type
);

export function init(): BaseSettings {
  return {
    autoDetectColorScheme: false,
    autoHideMenuBar: false,
    autocompleteDelay: 1200,
    clearOAuth2SessionOnRestart: true,
    darkTheme: getAppDefaultDarkTheme(),
    deviceId: null,
    disableHtmlPreviewJs: false,
    disableResponsePreviewLinks: false,
    disableAppVersionUserAgent: false,
    disableUpdateNotification: false,
    editorFontSize: 11,
    editorIndentSize: 2,
    editorIndentWithTabs: true,
    editorKeyMap: 'default',
    editorLineWrapping: true,
    enableAnalytics: true,
    showVariableSourceAndValue: false,
    filterResponsesByEnv: false,
    followRedirects: true,
    fontInterface: null,
    fontMonospace: null,
    fontSize: 13,
    fontVariantLigatures: false,
    forceVerticalLayout: false,
    hotKeyRegistry: hotkeys.newDefaultRegistry(),
    httpProxy: '',
    httpsProxy: '',
    lightTheme: getAppDefaultLightTheme(),
    maxHistoryResponses: 20,
    maxRedirects: 10,
    maxTimelineDataSizeKB: 10,
    noProxy: '',
    nunjucksPowerUserMode: false,
    pluginConfig: {},
    pluginPath: '',
    preferredHttpVersion: HttpVersions.default,
    proxyEnabled: false,
    showPasswords: false,
    theme: getAppDefaultTheme(),
    // milliseconds
    timeout: 30_000,
    updateAutomatically: true,
    updateChannel: UpdateChannel.stable,
    useBulkHeaderEditor: false,
    useBulkParametersEditor: false,
    validateAuthSSL: true,
    validateSSL: true,
    saveVaultKeyLocally: true,
    enableVaultInScripts: false,
    saveVaultKeyToOSSecretManager: true,
  };
}

export function migrate(doc: Settings) {
  try {
    doc = migrateEnsureHotKeys(doc);
    return doc;
  } catch (e) {
    console.log('[db] Error during settings migration', e);
    throw e;
  }
}

export async function all() {
  let settingsList = await db.all<Settings>(type);

  if (settingsList?.length === 0) {
    settingsList = [await getOrCreate()];
  }

  return settingsList;
}

async function create() {
  const settings = await db.docCreate<Settings>(type);
  return settings;
}

export async function update(settings: Settings, patch: Partial<Settings>) {
  const updatedSettings = await db.docUpdate<Settings>(settings, patch);
  return updatedSettings;
}

export async function patch(patch: Partial<Settings>) {
  const settings = await getOrCreate();
  const updatedSettings = await db.docUpdate<Settings>(settings, patch);
  return updatedSettings;
}

export async function getOrCreate() {
  const results = await db.all<Settings>(type) || [];

  if (results.length === 0) {
    return await create();
  }
  return results[0];
}

export async function get() {
  const results = await db.all<Settings>(type) || [];

  return results[0];
}

/**
 * Ensure map is updated when new hotkeys are added
 */
function migrateEnsureHotKeys(settings: Settings): Settings {
  const defaultHotKeyRegistry = hotkeys.newDefaultRegistry();

  // Remove any hotkeys that are no longer in the default registry
  const hotKeyRegistry = (Object.keys(settings.hotKeyRegistry) as KeyboardShortcut[]).reduce((newHotKeyRegistry, key) => {
    if (key in defaultHotKeyRegistry) {
      newHotKeyRegistry[key] = settings.hotKeyRegistry[key];
    }

    return newHotKeyRegistry;
  }, {} as Settings['hotKeyRegistry']);

  settings.hotKeyRegistry = { ...defaultHotKeyRegistry, ...hotKeyRegistry };
  return settings;
}
