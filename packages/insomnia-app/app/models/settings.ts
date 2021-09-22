import { HttpVersions, Settings as BaseSettings } from 'insomnia-common';
import { InsomniaConfig, validate } from 'insomnia-config';
import { keys, mergeLeft, omit } from 'ramda';

import {
  getAppDefaultDarkTheme,
  getAppDefaultLightTheme,
  getAppDefaultTheme,
  UPDATE_CHANNEL_STABLE,
} from '../common/constants';
import { database as db } from '../common/database';
import * as hotkeys from '../common/hotkeys';
import insomniaConfig from '../insomnia.config.json';
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

/** gets settings from the `insomnia.config.json` */
const getConfigSettings = ()  => {
  const { valid, errors } = validate(insomniaConfig as InsomniaConfig);
  if (!valid) {
    console.error('invalid insomnia config', errors);
    return {};
  }
  // This cast is important for testing intentionally bad values (the above validation will catch it, anyway)
  return insomniaConfig.settings as Required<InsomniaConfig>['settings'] || {};
};

export const isConfigControlledSetting = (setting: keyof BaseSettings): setting is keyof BaseSettings => (
  Object.prototype.hasOwnProperty.call(getConfigSettings(), setting)
);

const removeControlledSettings = omit(keys(getConfigSettings()));
const overwriteControlledSettings = mergeLeft(getConfigSettings());

export function init(): BaseSettings {
  return overwriteControlledSettings({
    autoDetectColorScheme: false,
    autoHideMenuBar: false,
    autocompleteDelay: 1200,
    clearOAuth2SessionOnRestart: true,
    darkTheme: getAppDefaultDarkTheme(),
    deviceId: null,
    disableHtmlPreviewJs: false,
    disableResponsePreviewLinks: false,
    disableUpdateNotification: false,
    disableUpsells: false,
    editorFontSize: 11,
    editorIndentSize: 2,
    editorIndentWithTabs: true,
    editorKeyMap: 'default',
    editorLineWrapping: true,
    enableAnalytics: false,
    environmentHighlightColorStyle: 'sidebar-indicator',
    filterResponsesByEnv: false,
    followRedirects: true,
    fontInterface: null,
    fontMonospace: null,
    fontSize: 13,
    fontVariantLigatures: false,
    forceVerticalLayout: false,

    // Only existing users updating from an older version should see the analytics prompt.
    // So by default this flag is set to false, and is toggled to true during initialization for new users.
    hasPromptedAnalytics: false,

    // Users should only see onboarding during first launch, and anybody updating from an older version should not see it, so by default this flag is set to true, and is toggled to false during initialization
    hasPromptedOnboarding: true,
    hasPromptedToMigrateFromDesigner: false,
    hotKeyRegistry: hotkeys.newDefaultRegistry(),
    httpProxy: '',
    httpsProxy: '',
    lightTheme: getAppDefaultLightTheme(),
    maxHistoryResponses: 20,
    maxRedirects: -1,
    maxTimelineDataSizeKB: 10,
    noProxy: '',
    nunjucksPowerUserMode: false,
    pluginConfig: {},
    pluginPath: '',
    preferredHttpVersion: HttpVersions.default,
    proxyEnabled: false,
    radioSilentMode: false,
    showPasswords: false,
    theme: getAppDefaultTheme(),
    timeout: 0,
    updateAutomatically: true,
    updateChannel: UPDATE_CHANNEL_STABLE,
    useBulkHeaderEditor: false,
    useBulkParametersEditor: false,
    validateAuthSSL: true,
    validateSSL: true,
  });
}

export function migrate(doc: Settings) {
  doc = migrateEnsureHotKeys(doc);
  return doc;
}

export async function all() {
  const settings = await db.all<Settings>(type);

  if (settings?.length === 0) {
    return [overwriteControlledSettings(await getOrCreate())];
  } else {
    return settings.map(overwriteControlledSettings);
  }
}

export async function create(patch: Partial<Settings> = {}) {
  return db.docCreate<Settings>(type, removeControlledSettings(patch));
}

export async function update(settings: Settings, patch: Partial<Settings>) {
  return db.docUpdate<Settings>(settings, removeControlledSettings(patch));
}

export async function patch(patch: Partial<Settings>) {
  const settings = await getOrCreate();
  return db.docUpdate<Settings>(settings, removeControlledSettings(patch));
}

export async function getOrCreate() {
  const results = await db.all<Settings>(type) || [];

  if (results.length === 0) {
    return create();
  } else {
    return results[0];
  }
}

/**
 * Ensure map is updated when new hotkeys are added
 */
function migrateEnsureHotKeys(settings: Settings): Settings {
  settings.hotKeyRegistry = { ...hotkeys.newDefaultRegistry(), ...settings.hotKeyRegistry };
  return settings;
}
