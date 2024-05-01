import { Analytics } from '@segment/analytics-node';
import { BrowserWindow, net } from 'electron';
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
// TODO: migrating session state to main would be more suitable than doing this.
const getAccountIdFromRenderer = async () => {
  let sessionId = '';
  let accountId = '';
  try {
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows[0];
    sessionId = await mainWindow.webContents.executeJavaScript('localStorage.getItem("currentSessionId");');
    const sessionJSON = await mainWindow.webContents.executeJavaScript(`localStorage.getItem("session__${(sessionId).slice(0, 10)}");`);
    const sessionData = JSON.parse(sessionJSON);
    accountId = sessionData?.accountId ?? '';
  } catch (e) {
    return { sessionId, accountId };
  }
  return { sessionId, accountId };
};
export async function trackSegmentEvent(
  event: SegmentEvent,
  properties?: Record<string, any>,
) {
  const settings = await models.settings.get();
  const { accountId } = await getAccountIdFromRenderer();

  const allowAnalytics = settings.enableAnalytics || accountId;
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
        userId: accountId,
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
  const { sessionId, accountId } = await getAccountIdFromRenderer();
  const allowAnalytics = settings.enableAnalytics || accountId;
  if (allowAnalytics) {
    try {
      const anonymousId = await getDeviceId() ?? '';
      const context = {
        app: { name: getProductName(), version: getAppVersion() },
        os: { name: _getOsName(), version: process.getSystemVersion() },
      };
      analytics.page({ name, context, anonymousId, userId: accountId }, error => {
        if (error) {
          console.warn('[analytics] Error sending segment event', error);
        }
      });

      if (sessionId) {
        net.fetch(getApiBaseURL() + '/v1/telemetry/', {
          method: 'POST',
          headers: new Headers({
            'X-Session-Id': sessionId,
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
