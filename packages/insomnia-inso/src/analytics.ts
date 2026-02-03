import os from 'node:os';

import { Analytics } from '@segment/analytics-node';
import { getSegmentWriteKey } from 'insomnia/src/common/constants';
import type { Settings } from 'insomnia/src/models/settings';
import { v4 as uuidv4 } from 'uuid';

import packageJson from '../package.json';
import neDbAdapter from './db/adapters/ne-db-adapter';
import { getAppDataDir, getDefaultProductName } from './util';

export enum InsoEvent {
  runTest = 'inso_run_test',
  runCollection = 'inso_run_collection',
  lintSpec = 'inso_lint_spec',
  exportSpec = 'inso_export_spec',
  script = 'inso_script',
}

const analyticsClient = new Analytics({ writeKey: getSegmentWriteKey() });
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

const getOsName = (): string => {
  switch (process.platform) {
    case 'darwin': {
      return 'mac';
    }
    case 'win32': {
      return 'windows';
    }
    default: {
      return process.platform;
    }
  }
};

export const trackInsoEvent = async (event: InsoEvent, properties?: Record<string, unknown>): Promise<void> => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const settings = await getLocalSettings();
  if (settings && !settings.enableAnalytics) {
    return;
  }

  try {
    const anonymousId = await getDeviceId();
    const version = process.env.VERSION || packageJson.version;

    analyticsClient.track(
      {
        event,
        anonymousId,
        properties: {
          ...properties,
          platform: 'cli',
        },
        context: {
          app: {
            name: 'inso',
            version,
          },
          os: {
            name: getOsName(),
            version: os.release(),
          },
        },
      },
      () => {
        // Silently fail
      },
    );
  } catch {
    // Silently fail
  }
};

export const flushAnalytics = async (): Promise<void> => {
  try {
    await analyticsClient.closeAndFlush({ timeout: 5000 });
  } catch {
    // Silently fail
  }
};
