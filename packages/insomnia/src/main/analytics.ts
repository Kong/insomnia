import crypto from 'node:crypto';

import { Analytics } from '@segment/analytics-node';
import * as Sentry from '@sentry/electron/main';
import { net } from 'electron';
import { v4 as uuidv4 } from 'uuid';

import { services } from '~/insomnia-data';

import {
  getApiBaseURL,
  getAppVersion,
  getClientString,
  getProductName,
  getSegmentWriteKey,
  PLAYWRIGHT,
} from '../common/constants';
import { platform } from '../common/platform';
import * as models from '../models/index';

let _currentOrganizationId: string | undefined;

export function setCurrentOrganizationId(id: string | undefined): void {
  _currentOrganizationId = id;
}

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
  const settings = await services.settings.get();
  return settings.deviceId || (await services.settings.update(settings, { deviceId: uuidv4() })).deviceId;
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
  requestCreated = 'Request Created',
  requestExecuted = 'Request Executed',
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
  gitAuthenticationCompleted = 'Git Authentication Completed',
  gitAuthenticationUpdated = 'Git Authentication Updated',
  buttonClick = 'Button Clicked',
  aiFeatureEnabled = 'AI Feature Enabled',
  aiFeatureDisabled = 'AI Feature Disabled',
  mcpClientConnected = 'MCP Client Connected',
  mcpClientDisconnected = 'MCP Client Disconnected',
  mcpToolCalled = 'MCP Tool Called',
  mcpResourceRead = 'MCP Resource Read',
  mcpPromptCalled = 'MCP Prompt Called',
  installPlugin = 'Plugin Installed',
}

function hashString(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function trackSegmentEvent(event: SegmentEvent, properties?: Record<string, any>) {
  if (PLAYWRIGHT) {
    return;
  }
  const settings = await services.settings.getOrCreate();
  const userSession = await models.userSession.getOrCreate();
  if (!userSession?.hashedAccountId) {
    userSession.hashedAccountId = userSession?.accountId ? hashString(userSession.accountId) : '';
  }
  const allowAnalytics = settings.enableAnalytics || userSession?.hashedAccountId;
  if (allowAnalytics) {
    try {
      const anonymousId = (await getDeviceId()) ?? '';
      const context = {
        app: { name: getProductName(), version: getAppVersion() },
        os: { name: _getOsName(), version: process.getSystemVersion() },
      };

      analytics.track(
        {
          event,
          properties: {
            ...(_currentOrganizationId && { organization_id: _currentOrganizationId }),
            ...properties,
            platform: 'app',
          },
          context,
          anonymousId,
          userId: userSession?.hashedAccountId || '',
        },
        error => {
          if (error) {
            console.warn('[analytics] Error sending segment event', error);
          }
        },
      );
    } catch (error: unknown) {
      console.warn('[analytics] Unexpected error while sending segment event', error);
    } finally {
      if (!userSession?.hashedAccountId && [SegmentEvent.unitTestRun, SegmentEvent.unitTestRunAll].includes(event)) {
        Sentry.captureException(`Run tests by anonymous`, {
          tags: {
            source: 'main/analytics',
          },
          extra: {
            organizationId: properties?.organizationId || '',
            projectId: properties?.projectId || '',
          },
        });
      }
    }
  }
}

export async function trackPageView(name: string) {
  if (PLAYWRIGHT) {
    return;
  }
  const settings = await services.settings.getOrCreate();
  const userSession = await models.userSession.getOrCreate();
  if (!userSession?.hashedAccountId) {
    userSession.hashedAccountId = userSession?.accountId ? hashString(userSession.accountId) : '';
  }

  const allowAnalytics = settings.enableAnalytics || userSession?.hashedAccountId;
  if (allowAnalytics) {
    try {
      const anonymousId = (await getDeviceId()) ?? '';
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
  switch (platform) {
    case 'darwin': {
      return 'mac';
    }
    case 'win32': {
      return 'windows';
    }
    default: {
      return platform;
    }
  }
}
