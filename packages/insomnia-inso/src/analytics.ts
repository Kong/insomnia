import os from 'node:os';

import { getSegmentWriteKey } from 'insomnia/src/common/constants';
import { InsoEvent, InsomniaAnalytics } from 'insomnia-analytics';
import { v4 as uuidv4 } from 'uuid';

import type { Settings } from '~/insomnia-data';

import packageJson from '../package.json';
import neDbAdapter from './db/adapters/ne-db-adapter';
import { getAppDataDir, getDefaultProductName } from './util';

export { InsoEvent };

const analytics = new InsomniaAnalytics({
  writeKey: getSegmentWriteKey(),
  app: {
    appName: 'inso',
    appVersion: process.env.VERSION || packageJson.version,
    osVersion: () => os.release(),
    platform: 'cli',
  },
});

let deviceId: string | null = null;
let localSettings: Settings | null = null;

const getLocalSettings = async (): Promise<Settings | null> => {
  if (localSettings) {
    return localSettings;
  }

  try {
    const appDataDir = getAppDataDir(getDefaultProductName());
    const db = await neDbAdapter(appDataDir, ['Settings']);
    localSettings = db?.Settings?.[0] ?? null;
    return localSettings;
  } catch {
    return null;
  }
};

const getDeviceId = async (): Promise<string> => {
  if (deviceId) {
    return deviceId;
  }

  try {
    const settings = await getLocalSettings();
    if (settings?.deviceId) {
      deviceId = settings.deviceId;
      return deviceId;
    }
  } catch {}

  deviceId = `anon_${uuidv4()}`;
  return deviceId;
};

export const trackInsoEvent = async (event: InsoEvent, properties?: Record<string, unknown>): Promise<void> => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  // new for v13 - provide a way to disable analytics
  if (process.env.INSO_TELEMETRY_DISABLED) {
    return;
  }

  const settings = await getLocalSettings();
  if (settings && !settings.enableAnalytics) {
    return;
  }

  try {
    const anonymousId = await getDeviceId();
    analytics.track({ event, anonymousId, properties });
  } catch {}
};

export const flushAnalytics = async (): Promise<void> => {
  await analytics.closeAndFlush(5000);
};
