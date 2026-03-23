import { getAppDefaultDarkTheme, getAppDefaultLightTheme, getAppDefaultTheme } from '~/common/constants';
import * as hotkeys from '~/common/hotkeys';
import { HttpVersions, type KeyboardShortcut, type Settings as BaseSettings, UpdateChannel } from '~/common/settings';
import type { BaseModel } from '~/models/types';

export type Settings = BaseModel & BaseSettings;
export const name = 'Settings';
export const type = 'Settings';
export const prefix = 'set';
export const canDuplicate = false;
export const canSync = false;

export type ThemeSettings = Pick<Settings, 'autoDetectColorScheme' | 'lightTheme' | 'darkTheme' | 'theme'>;

export const isSettings = (model: Pick<BaseModel, 'type'>): model is Settings => model.type === type;

// force vertical layout for playwright tests to avoid horizontal scrolling issues
const forceVerticalLayout = process.env.PLAYWRIGHT ? true : false;

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
    enableKeyMapForInlineTextEditors: false,
    editorLineWrapping: true,
    enableAnalytics: true,
    showVariableSourceAndValue: false,
    filterResponsesByEnv: false,
    followRedirects: true,
    fontInterface: null,
    fontMonospace: null,
    fontSize: 13,
    fontVariantLigatures: false,
    forceVerticalLayout,
    hotKeyRegistry: hotkeys.newDefaultRegistry(),
    httpProxy: '',
    httpsProxy: '',
    lightTheme: getAppDefaultLightTheme(),
    maxHistoryResponses: 20,
    maxRedirects: 10,
    maxTimelineDataSizeKB: 10,
    pluginNodeExtraCerts: '',
    pluginsAllowElevatedAccess: false,
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
    // The duration in mins for which the external vault secret is cached
    vaultSecretCacheDuration: 30,
    dataFolders: [],
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

/**
 * Ensure map is updated when new hotkeys are added
 */
function migrateEnsureHotKeys(settings: Settings): Settings {
  const defaultHotKeyRegistry = hotkeys.newDefaultRegistry();

  // Remove any hotkeys that are no longer in the default registry
  const hotKeyRegistry = (Object.keys(settings.hotKeyRegistry) as KeyboardShortcut[]).reduce(
    (newHotKeyRegistry, key) => {
      if (key in defaultHotKeyRegistry) {
        newHotKeyRegistry[key] = settings.hotKeyRegistry[key];
      }

      return newHotKeyRegistry;
    },
    {} as Settings['hotKeyRegistry'],
  );

  settings.hotKeyRegistry = { ...defaultHotKeyRegistry, ...hotKeyRegistry };
  return settings;
}
