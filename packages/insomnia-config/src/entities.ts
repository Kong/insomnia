/** While, by design, there is presently no specific restriction in the validation that _requires_ that the file have a particular filename, this is the canonical name of the file that we use in all current use-cases. */
export const INSOMNIA_CONFIG_FILENAME = 'insomnia.config.json';

export type ConfigVersion = '1.0.0';

export interface AllowedSettings {
  allowNotificationRequests: boolean;
  disableUpdateNotification: boolean;
  enableAnalytics: boolean;
  disablePaidFeatureAds: boolean;
  incognitoMode: boolean;
}

/**
 * Configuration for Insomnia.
 *
 * @TJS-title Insomnia Config
 */
export interface InsomniaConfig {
  insomniaConfig: ConfigVersion;
  settings?: AllowedSettings;
}
