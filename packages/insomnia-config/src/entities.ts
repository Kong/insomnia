/** While, by design, there is presently no specific restriction in the validation that _requires_ that the file have a particular filename, this is the canonical name of the file that we use in all current use-cases. */
export const INSOMNIA_CONFIG_FILENAME = 'insomnia.config.json';

export type ConfigVersion = '1.0.0';

interface Settings {
  /** If false, Insomnia won't send requests to the api.insomnia.rest/notifications endpoint. This can have effects like: users won’t be notified in-app about billing issues, and they won’t receive tips about app usage. */
  allowNotificationRequests: boolean;
  /** If true, Insomnia won’t show a notification when new updates are available. Users can still check for updates in Preferences. */
  disableUpdateNotification: boolean;
  /** If true, Insomnia will send anonymous data about features and plugins used. */
  enableAnalytics: boolean;
  /** If true, Insomnia won’t show any visual elements that recommend plan upgrades. */
  disablePaidFeatureAds: boolean;
  /** If true, won’t make any network requests other than the requests you ask it to send. This configuration controls Send Usage Stats (`enableAnalytics`) and Allow Notification Requests (`allowNotificationRequests`). */
  incognitoMode: boolean;
}
export type AllowedSettings = Partial<Pick<Settings,
  | 'allowNotificationRequests'
  | 'disableUpdateNotification'
  | 'enableAnalytics'
  | 'disablePaidFeatureAds'
  | 'incognitoMode'
>>;

/**
 * Configuration for Insomnia.
 *
 * @TJS-title Insomnia Config
 */
export interface InsomniaConfig {
  insomniaConfig: ConfigVersion;
  settings?: AllowedSettings;
}
