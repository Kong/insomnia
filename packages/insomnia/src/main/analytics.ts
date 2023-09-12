import { Analytics } from '@segment/analytics-node';
import { v4 as uuidv4 } from 'uuid';

import * as session from '../account/session';
import { getAccountId } from '../account/session';
import {
  getAppPlatform,
  getAppVersion,
  getProductName,
  getSegmentWriteKey,
} from '../common/constants';
import * as models from '../models/index';
import { insomniaFetch } from './insomniaFetch';

const analytics = new Analytics({ writeKey: getSegmentWriteKey() });

const getDeviceId = async () => {
  const settings = await models.settings.get();
  return settings.deviceId || (await models.settings.update(settings, { deviceId: uuidv4() })).deviceId;
};

export enum SegmentEvent {
  appStarted = 'App Started',
  collectionCreate = 'Collection Created',
  dataExport = 'Data Exported',
  dataImport = 'Data Imported',
  documentCreate = 'Document Created',
  kongConnected = 'Kong Connected',
  kongSync = 'Kong Synced',
  requestBodyTypeSelect = 'Request Body Type Selected',
  requestCreate = 'Request Created',
  requestExecute = 'Request Executed',
  projectLocalCreate = 'Local Project Created',
  projectLocalDelete = 'Local Project Deleted',
  testSuiteCreate = 'Test Suite Created',
  testSuiteDelete = 'Test Suite Deleted',
  unitTestCreate = 'Unit Test Created',
  unitTestDelete = 'Unit Test Deleted',
  unitTestRun = 'Ran Individual Unit Test',
  unitTestRunAll = 'Ran All Unit Tests',
  vcsSyncStart = 'VCS Sync Started',
  vcsSyncComplete = 'VCS Sync Completed',
  vcsAction = 'VCS Action Executed',
  buttonClick = 'Button Clicked',
}

export async function trackSegmentEvent(
  event: SegmentEvent,
  properties?: Record<string, any>,
) {
  const settings = await models.settings.get();
  const allowAnalytics = settings.enableAnalytics || session.isLoggedIn();
  if (allowAnalytics) {
    try {
      const anonymousId = await getDeviceId() ?? '';
      const userId = getAccountId();
      const context = {
        app: { name: getProductName(), version: getAppVersion() },
        os: { name: _getOsName(), version: process.getSystemVersion() },
      };
      analytics.track({
        event,
        properties,
        context,
        anonymousId,
        userId,
      }, error => {
        if (error) {
          console.warn('[analytics] Error sending segment event', error);
        }
      });
    } catch (error: unknown) {
      console.warn('[analytics] Unexpected error while sending segment event', error);
    }
  }
}

export async function trackPageView(name: string) {
  const settings = await models.settings.get();
  const allowAnalytics = settings.enableAnalytics || session.isLoggedIn();
  if (allowAnalytics) {
    try {
      const anonymousId = await getDeviceId() ?? '';
      const userId = getAccountId();
      const context = {
        app: { name: getProductName(), version: getAppVersion() },
        os: { name: _getOsName(), version: process.getSystemVersion() },
      };
      analytics.page({ name, context, anonymousId, userId }, error => {
        if (error) {
          console.warn('[analytics] Error sending segment event', error);
        }
      });
      sendTelemetry();
    } catch (error: unknown) {
      console.warn('[analytics] Unexpected error while sending segment event', error);
    }
  }
}

export async function sendTelemetry() {
  if (session.isLoggedIn()) {
    insomniaFetch({
      method: 'POST',
      path: '/v1/telemetry/',
      sessionId: session.getCurrentSessionId(),
    }).catch((error: unknown) => {
      console.warn('[analytics] Unexpected error while sending telemetry', error);
    });
  }
}

// ~~~~~~~~~~~~~~~~~ //
// Private Functions //
// ~~~~~~~~~~~~~~~~~ //
function _getOsName() {
  const platform = getAppPlatform();
  switch (platform) {
    case 'darwin':
      return 'mac';
    case 'win32':
      return 'windows';
    default:
      return platform;
  }
}
