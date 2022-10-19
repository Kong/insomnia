import { HttpVersions, KeyboardShortcut, Settings as BaseSettings, UpdateChannel } from 'insomnia-common';

import {
  getAppDefaultDarkTheme,
  getAppDefaultLightTheme,
  getAppDefaultTheme,
} from '../common/constants';
import { database as db } from '../common/database';
import * as hotkeys from '../common/hotkeys';
import { getMonkeyPatchedControlledSettings, omitControlledSettings } from './helpers/settings';
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
    allowNotificationRequests: true,
    clearOAuth2SessionOnRestart: true,
    darkTheme: getAppDefaultDarkTheme(),
    deviceId: null,
    disableHtmlPreviewJs: false,
    disablePaidFeatureAds: false,
    disableResponsePreviewLinks: false,
    disableUpdateNotification: false,
    editorFontSize: 11,
    editorIndentSize: 2,
    editorIndentWithTabs: true,
    editorKeyMap: 'default',
    editorLineWrapping: true,
    enableAnalytics: false,
    environmentHighlightColorStyle: 'sidebar-indicator',
    showVariableSourceAndValue: false,
    filterResponsesByEnv: false,
    followRedirects: true,
    fontInterface: null,
    fontMonospace: null,
    fontSize: 13,
    fontVariantLigatures: false,
    forceVerticalLayout: false,

    /**
     * Only existing users updating from an older version should see the analytics prompt.
     * So by default this flag is set to false, and is toggled to true during initialization for new users.
     */
    hasPromptedAnalytics: false,
    hotKeyRegistry: hotkeys.newDefaultRegistry(),
    httpProxy: '',
    httpsProxy: '',
    incognitoMode: false,
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
  };
}

export function migrate(doc: Settings) {
  doc = migrateEnsureHotKeys(doc);
  return doc;
}

export async function all() {
  let settingsList = await db.all<Settings>(type);

  if (settingsList?.length === 0) {
    settingsList = [await getOrCreate()];
  }

  return settingsList.map(getMonkeyPatchedControlledSettings);
}

async function create() {
  const settings = await db.docCreate<Settings>(type);
  return getMonkeyPatchedControlledSettings(settings);
}

export async function update(settings: Settings, patch: Partial<Settings>) {
  const sanitizedPatch = omitControlledSettings(settings, patch);
  const updatedSettings = await db.docUpdate<Settings>(settings, sanitizedPatch);
  return getMonkeyPatchedControlledSettings(updatedSettings);
}

export async function patch(patch: Partial<Settings>) {
  const settings = await getOrCreate();
  const sanitizedPatch = omitControlledSettings(settings, patch);
  const updatedSettings = await db.docUpdate<Settings>(settings, sanitizedPatch);
  return getMonkeyPatchedControlledSettings(updatedSettings);
}

export async function getOrCreate() {
  const results = await db.all<Settings>(type) || [];

  if (results.length === 0) {
    return await create();
  }
  return getMonkeyPatchedControlledSettings(results[0]);
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
