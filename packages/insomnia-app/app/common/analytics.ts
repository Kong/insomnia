import Analytics from 'analytics-node';
import * as uuid from 'uuid';

import { getAccountId } from '../account/session';
import { database as db } from '../common/database';
import * as models from '../models/index';
import { isSettings } from '../models/settings';
import {
  getAppName,
  getAppPlatform,
  getAppVersion,
  getSegmentWriteKey,
} from './constants';

const segmentClient = new Analytics(getSegmentWriteKey(), {
  // @ts-expect-error -- TSCONVERSION
  axiosConfig: {
    // This is needed to ensure that we use the NodeJS adapter in the render process
    ...(global?.require && {
      adapter: global.require('axios/lib/adapters/http'),
    }),
  },
});

export enum SegmentEvent {
  appStarted = 'App Started',
  collectionCreate = 'Collection Created',
  criticalError = 'Critical Error Encountered',
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
}

type PushPull = 'push' | 'pull';

export function vcsSegmentEventProperties(
  type: 'git',
  action: PushPull | `force_${PushPull}` |
   'create_branch' | 'merge_branch' | 'delete_branch' | 'checkout_branch' |
   'commit' | 'stage_all' | 'stage' | 'unstage_all' | 'unstage' | 'rollback' | 'rollback_all' |
   'update' | 'setup' | 'clone',
  error?: string
) {
  return {
    'type': type,
    'action': action,
    'error': error,
  };
}

interface QueuedSegmentEvent {
  event: SegmentEvent;
  properties?: Record<string, any>;
  /**
   * timestamps are required for Queued Segment Events so that when/if the event is enventually fired, it's fired with the timestamp when the event actually occurred.
   * see: https://segment.com/docs/connections/spec/common
   */
  timestamp: Date;
}

/**
 * Flush any analytics events that were built up when analytics were disabled.
 */
let queuedEvents: QueuedSegmentEvent[] = [];

async function flushQueuedEvents() {
  console.log(`[segment] Flushing ${queuedEvents.length} queued events`, queuedEvents);
  const events = [...queuedEvents];

  // Clear queue before we even start sending to prevent races
  queuedEvents = [];

  await Promise.all(events.map(({ event, properties, timestamp }) => (
    trackSegmentEvent(event, properties, { timestamp })
  )));
}

interface TrackSegmentEventOptions {
  /**
   * Tracks an analytics event but queues it for later if analytics are currently disabled
   * Once analytics setting is enabled, any queued events will be sent automatically, all at once.
   */
  queueable?: boolean;

  timestamp?: Date;
}

export async function trackSegmentEvent(
  event: SegmentEvent,
  properties?: Record<string, any>,
  { queueable, timestamp }: TrackSegmentEventOptions = {},
) {
  const settings = await models.settings.getOrCreate();

  if (!settings.enableAnalytics) {
    if (queueable) {
      const queuedEvent: QueuedSegmentEvent = {
        event,
        properties,
        timestamp: new Date(),
      };
      console.log('[segment] Queued event', queuedEvent);
      queuedEvents.push(queuedEvent);
    }
    return;
  }

  try {
    const anonymousId = await getDeviceId();
    segmentClient.track({
      anonymousId,
      // This may return an empty string or undefined when a user is not logged in
      userId: getAccountId(),
      event,
      properties,
      ...(timestamp ? { timestamp } : {}),
      context: {
        app: {
          name: getAppName(),
          version: getAppVersion(),
        },
        os: {
          name: _getOsName(),
          version: process.getSystemVersion(),
        },
      },
    }, error => {
      if (error) {
        console.warn('[analytics] Error sending segment event', error);
      }
    });
  } catch (error: unknown) {
    console.warn('[analytics] Unexpected error while sending segment event', error);
  }
}

export async function trackPageView(name: string) {
  console.log('[segment] Page view', name);
  const anonymousId = await getDeviceId();
  segmentClient.page({
    anonymousId,
    userId: getAccountId(),
    name,
  });
}

export async function getDeviceId() {
  const settings = await models.settings.getOrCreate();
  let { deviceId } = settings;

  if (!deviceId) {
    // Migrate old GA ID into settings model if needed
    const oldId = (window && window.localStorage.getItem('gaClientId')) || null;
    deviceId = oldId || uuid.v4();
    await models.settings.update(settings, {
      deviceId,
    });
  }

  return deviceId;
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

// Monitor database changes to see if analytics gets enabled.
// If analytics become enabled, flush any queued events.
db.onChange(async changes => {
  for (const change of changes) {
    const [event, doc] = change;

    if (isSettings(doc) && event === 'update') {
      if (doc.enableAnalytics) {
        await flushQueuedEvents();
      }
    }
  }
});
