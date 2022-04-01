import { Settings } from 'insomnia-common';

/** While, by design, there is presently no specific restriction in the validation that _requires_ that the file have a particular filename, this is the canonical name of the file that we use in all current use-cases. */
export const INSOMNIA_CONFIG_FILENAME = 'insomnia.config.json';

export type ConfigVersion = '1.0.0';

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
