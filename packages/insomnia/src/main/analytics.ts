import crypto from 'node:crypto';

import * as Sentry from '@sentry/electron/main';
import { net } from 'electron';
import { AnalyticsEvent, InsomniaAnalytics } from 'insomnia-analytics';
import { services } from 'insomnia-data';
import { v4 as uuidv4 } from 'uuid';

import {
  getApiBaseURL,
  getAppVersion,
  getClientString,
  getProductName,
  getSegmentWriteKey,
  PLAYWRIGHT_TEST,
} from '../common/constants';

export { AnalyticsEvent };

let _currentOrganizationId: string | undefined;

export function setCurrentOrganizationId(id: string | undefined): void {
  _currentOrganizationId = id;
}

const analytics = new InsomniaAnalytics({
  writeKey: getSegmentWriteKey(),
  app: {
    appName: getProductName(),
    appVersion: getAppVersion(),
    osVersion: () => process.getSystemVersion(),
    platform: 'app',
  },
  settings: {
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
  },
  onError: error => {
    console.warn('[analytics] Error sending analytics event', error);
  },
});

const getDeviceId = async () => {
  const settings = await services.settings.get();
  return settings.deviceId || (await services.settings.update(settings, { deviceId: uuidv4() })).deviceId;
};

function hashString(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function trackAnalyticsEvent(event: AnalyticsEvent, properties?: Record<string, any>) {
  if (PLAYWRIGHT_TEST) {
    return;
  }
  const settings = await services.settings.getOrCreate();
  const userSession = await services.userSession.get();
  if (!userSession?.hashedAccountId) {
    userSession.hashedAccountId = userSession?.accountId ? hashString(userSession.accountId) : '';
  }
  const allowAnalytics = settings.enableAnalytics || userSession?.hashedAccountId;
  if (!allowAnalytics) {
    return;
  }

  try {
    const anonymousId = (await getDeviceId()) ?? '';
    analytics.track({
      event,
      properties: {
        ...(_currentOrganizationId && { organization_id: _currentOrganizationId }),
        ...properties,
      },
      anonymousId,
      userId: userSession?.hashedAccountId || '',
    });
  } catch (error: unknown) {
    console.warn('[analytics] Unexpected error while sending analytics event', error);
  } finally {
    if (!userSession?.hashedAccountId && [AnalyticsEvent.unitTestRun, AnalyticsEvent.unitTestRunAll].includes(event)) {
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

export async function trackPageView(name: string) {
  if (PLAYWRIGHT_TEST) {
    return;
  }
  const settings = await services.settings.getOrCreate();
  const userSession = await services.userSession.get();
  if (!userSession?.hashedAccountId) {
    userSession.hashedAccountId = userSession?.accountId ? hashString(userSession.accountId) : '';
  }

  const allowAnalytics = settings.enableAnalytics || userSession?.hashedAccountId;
  if (!allowAnalytics) {
    return;
  }

  try {
    const anonymousId = (await getDeviceId()) ?? '';
    analytics.page({ name, anonymousId, userId: userSession?.hashedAccountId });

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
    console.warn('[analytics] Unexpected error while sending analytics event', error);
  }
}
