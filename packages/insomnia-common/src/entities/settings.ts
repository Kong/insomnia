import { HttpVersion } from '../constants';
import { HotKeyRegistry } from './hotkeys';

type Sides = 'top' | 'bottom' | 'left' | 'right';
type WindowSides = `window-${Sides}`;
type SidebarSides = `sidebar-${'edge' | 'indicator'}`;
export type EnvironmentHighlightColorStyle = WindowSides | SidebarSides;

export enum UpdateChannel {
  stable = 'stable',
  beta = 'beta',
}

/** Gets a subset of Settings where the values match a condition */
export type SettingsOfType<MatchType> = NonNullable<{
  [Key in keyof Settings]: Settings[Key] extends MatchType ? Key : never;
}[keyof Settings]>;

export interface PluginConfig {
  disabled: boolean;
}

export type PluginConfigMap = Record<string, PluginConfig>;

export interface Settings {
  /** If false, Insomnia won't send requests to the api.insomnia.rest/notifications endpoint. This can have effects like: users won’t be notified in-app about billing issues, and they won’t receive tips about app usage. */
  allowNotificationRequests: boolean;
  autoDetectColorScheme: boolean;
  autoHideMenuBar: boolean;
  autocompleteDelay: number;
  clearOAuth2SessionOnRestart: boolean;
  darkTheme: string;
  deviceId: string | null;
  disableHtmlPreviewJs: boolean;

  /** If true, Insomnia won’t show any visual elements that recommend plan upgrades. */
  disablePaidFeatureAds: boolean;
  disableResponsePreviewLinks: boolean;

  /** If true, Insomnia won’t show a notification when new updates are available. Users can still check for updates in Preferences. */
  disableUpdateNotification: boolean;
  editorFontSize: number;
  editorIndentSize: number;
  editorIndentWithTabs: boolean;
  editorKeyMap: string;
  editorLineWrapping: boolean;

  /** If true, Insomnia will send anonymous data about features and plugins used. */
  enableAnalytics: boolean;
  environmentHighlightColorStyle: EnvironmentHighlightColorStyle;
  filterResponsesByEnv: boolean;
  followRedirects: boolean;
  fontInterface: string | null;
  fontMonospace: string | null;
  fontSize: number;
  fontVariantLigatures: boolean;
  forceVerticalLayout: boolean;
  hasPromptedAnalytics: boolean;
  hotKeyRegistry: HotKeyRegistry;
  httpProxy: string;
  httpsProxy: string;
  showVariableSourceAndValue: boolean;
  lightTheme: string;
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

  /** If true, won’t make any network requests other than the requests you ask it to send. This configuration controls Send Usage Stats (`enableAnalytics`) and Allow Notification Requests (`allowNotificationRequests`). */
  incognitoMode: boolean;
  showPasswords: boolean;
  theme: string;
  timeout: number;
  updateAutomatically: boolean;
  updateChannel: UpdateChannel;
  useBulkHeaderEditor: boolean;
  useBulkParametersEditor: boolean;
  validateAuthSSL: boolean;
  validateSSL: boolean;
}
