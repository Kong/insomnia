import { Analytics } from '@segment/analytics-node';
import crypto from 'crypto';
import { net } from 'electron';
import { v4 as uuidv4 } from 'uuid';

import {
  getApiBaseURL,
  getAppPlatform,
  getAppVersion,
  getClientString,
  getProductName,
  getSegmentWriteKey,
} from '../common/constants';
import * as models from '../models/index';

const analytics = new Analytics({
  writeKey: getSegmentWriteKey(),
  httpClient: {
    makeRequest(_options) {
      return net.fetch(_options.url, {
        method: _options.method,
        headers: _options.headers,
        body: _options.body,
        signal: AbortSignal.timeout(_options.httpRequestTimeout),
      });
    },
  },
});

const getDeviceId = async () => {
  const settings = await models.settings.get();
  return settings.deviceId || (await models.settings.update(settings, { deviceId: uuidv4() })).deviceId;
};

export enum SegmentEvent {
  appStarted = 'App Started',
  collectionCreate = 'Collection Created',
  dataExport = 'Data Exported',
  dataImport = 'Data Imported',
  loginSuccess = 'Login Success',
  documentCreate = 'Document Created',
  kongConnected = 'Kong Connected',
  kongSync = 'Kong Synced',
  requestBodyTypeSelect = 'Request Body Type Selected',
  requestCreate = 'Request Created',
  requestExecute = 'Request Executed',
  collectionRunExecute = 'Collection Run Executed',
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

function hashString(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function trackSegmentEvent(
  event: SegmentEvent,
  properties?: Record<string, any>,
) {
  const settings = await models.settings.getOrCreate();
  const userSession = await models.userSession.getOrCreate();
  if (!userSession?.hashedAccountId) {
    userSession.hashedAccountId = userSession?.accountId ? hashString(userSession.accountId) : '';
  }
  const allowAnalytics = settings.enableAnalytics || userSession?.hashedAccountId;
  if (allowAnalytics) {
    try {
      const anonymousId = await getDeviceId() ?? '';
      const context = {
        app: { name: getProductName(), version: getAppVersion() },
        os: { name: _getOsName(), version: process.getSystemVersion() },
      };

      analytics.track({
        event,
        properties,
        context,
        anonymousId,
        userId: userSession?.hashedAccountId || '',
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
  const settings = await models.settings.getOrCreate();
  const userSession = await models.userSession.getOrCreate();
  if (!userSession?.hashedAccountId) {
    userSession.hashedAccountId = userSession?.accountId ? hashString(userSession.accountId) : '';
  }

  const allowAnalytics = settings.enableAnalytics || userSession?.hashedAccountId;
  if (allowAnalytics) {
    try {
      const anonymousId = await getDeviceId() ?? '';
      const context = {
        app: { name: getProductName(), version: getAppVersion() },
        os: { name: _getOsName(), version: process.getSystemVersion() },
      };

      analytics.page({ name, context, anonymousId, userId: userSession?.hashedAccountId }, error => {
        if (error) {
          console.warn('[analytics] Error sending segment event', error);
        }
      });

      if (userSession?.id) {
        net.fetch(getApiBaseURL() + '/v1/telemetry/', {
          method: 'POST',
          headers: new Headers({
            'X-Session-Id': userSession?.id,
            'X-Insomnia-Client': getClientString(),
          }),
        });
      }
    } catch (error: unknown) {
      console.warn('[analytics] Unexpected error while sending segment event', error);
    }
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
