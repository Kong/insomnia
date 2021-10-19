import { Settings } from 'insomnia-common';

type ConfigVersion = '1.0.0';

type AllowedSettings = Partial<Pick<Settings,
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
