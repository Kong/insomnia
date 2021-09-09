import type { HttpVersion } from '../common/constants';
import {
  getAppDefaultDarkTheme,
  getAppDefaultLightTheme,
  getAppDefaultTheme,
  HttpVersions,
  UPDATE_CHANNEL_STABLE,
} from '../common/constants';
import { database as db } from '../common/database';
import * as hotkeys from '../common/hotkeys';
import type { BaseModel } from './index';

export interface PluginConfig {
  disabled: boolean;
}

export type PluginConfigMap = Record<string, PluginConfig>;

export interface BaseSettings {
  autoHideMenuBar: boolean;
  autocompleteDelay: number;
  deviceId: string | null;
  disableHtmlPreviewJs: boolean;
  disableResponsePreviewLinks: boolean;
  disableUpdateNotification: boolean;
  editorFontSize: number;
  editorIndentSize: number;
  editorIndentWithTabs: boolean;
  editorKeyMap: string;
  editorLineWrapping: boolean;
  enableAnalytics: boolean;
  environmentHighlightColorStyle: string;
  filterResponsesByEnv: boolean;
  followRedirects: boolean;
  clearOAuth2SessionOnRestart: boolean;
  fontInterface: string | null;
  fontMonospace: string | null;
  fontSize: number;
  fontVariantLigatures: boolean;
  forceVerticalLayout: boolean;
  hotKeyRegistry: hotkeys.HotKeyRegistry;
  httpProxy: string;
  httpsProxy: string;
  lineWrapping?: boolean;
  maxHistoryResponses: number;
  maxRedirects: number;
  maxTimelineDataSizeKB: number;
  noProxy: string;
  nunjucksPowerUserMode: boolean;
  pluginConfig: PluginConfigMap;
  pluginPath: string;
  preferredHttpVersion: HttpVersion;
  proxyEnabled: boolean;
  showPasswords: boolean;
  theme: string;
  autoDetectColorScheme: boolean;
  lightTheme: string;
  darkTheme: string;
  timeout: number;
  updateAutomatically: boolean;
  updateChannel: string;
  useBulkHeaderEditor: boolean;
  useBulkParametersEditor: boolean;
  validateAuthSSL: boolean;
  validateSSL: boolean;
  hasPromptedToMigrateFromDesigner: boolean;
  hasPromptedOnboarding: boolean;
  hasPromptedAnalytics: boolean;
  isVariableUncovered?: boolean;
}

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
    autoHideMenuBar: false,
    autocompleteDelay: 1200,
    deviceId: null,
    disableHtmlPreviewJs: false,
    disableResponsePreviewLinks: false,
    disableUpdateNotification: false,
    editorFontSize: 11,
    editorIndentSize: 2,
    editorIndentWithTabs: true,
    editorKeyMap: 'default',
    editorLineWrapping: true,
    enableAnalytics: false,
    environmentHighlightColorStyle: 'sidebar-indicator',
    filterResponsesByEnv: false,
    followRedirects: true,
    clearOAuth2SessionOnRestart: true,
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
    pluginConfig: {},
    pluginPath: '',
    preferredHttpVersion: HttpVersions.default,
    proxyEnabled: false,
    showPasswords: false,
    theme: getAppDefaultTheme(),
    autoDetectColorScheme: false,
    lightTheme: getAppDefaultLightTheme(),
    darkTheme: getAppDefaultDarkTheme(),
    timeout: 0,
    updateAutomatically: true,
    updateChannel: UPDATE_CHANNEL_STABLE,
    useBulkHeaderEditor: false,
    useBulkParametersEditor: false,
    validateAuthSSL: true,
    validateSSL: true,
    hasPromptedToMigrateFromDesigner: false,
    // Users should only see onboarding during first launch, and anybody updating from an
    // older version should not see it, so by default this flag is set to true, and is toggled
    // to false during initialization
    hasPromptedOnboarding: true,
    // Only existing users updating from an older version should see the analytics prompt
    // So by default this flag is set to false, and is toggled to true during initialization
    // for new users
    hasPromptedAnalytics: false,
  };
}

export function migrate(doc: Settings) {
  doc = migrateEnsureHotKeys(doc);
  return doc;
}

export async function all() {
  const settings = await db.all<Settings>(type);

  if (settings?.length === 0) {
    return [await getOrCreate()];
  } else {
    return settings;
  }
}

export async function create(patch: Partial<Settings> = {}) {
  return db.docCreate<Settings>(type, patch);
}

export async function update(settings: Settings, patch: Partial<Settings>) {
  return db.docUpdate<Settings>(settings, patch);
}

export async function patch(patch: Partial<Settings>) {
  const settings = await getOrCreate();
  return db.docUpdate<Settings>(settings, patch);
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
