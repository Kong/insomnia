import { Settings as CommonSettings } from 'insomnia-common';

type AllowedSettings = Partial<Pick<CommonSettings,
  | 'allowNotificationRequests'
  | 'disableUpdateNotification'
  | 'enableAnalytics'
  | 'hideUpsells'
  | 'incognitoMode'
>>;

/**
 * Configuration for Insomnia.
 *
 * @TJS-title Insomnia Config
 */
export interface InsomniaConfig {
  version: '1.0.0';
  name: 'Insomnia Config';
  settings?: AllowedSettings;
}
