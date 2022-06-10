import Analytics from 'analytics-node';
import { AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';

import { getAccountId } from '../account/session';
import { database as db } from '../common/database';
import * as models from '../models/index';
import { isSettings } from '../models/settings';
import {
  getAppPlatform,
  getAppVersion,
  getProductName,
  getSegmentWriteKey,
} from './constants';

const axiosConfig: AxiosRequestConfig = {
  // This is needed to ensure that we use the NodeJS adapter in the render process
  ...(global?.require ? {
    adapter: global.require('axios/lib/adapters/http'),
  } : {}),
};

const segmentClient = new Analytics(getSegmentWriteKey(), {
  // @ts-expect-error this is missing from the analytics-node types (and docs) but is present in the source code
  // https://github.com/segmentio/analytics-node/blob/0a6aa0d9d865b56f799f9d014b4d7b98ae5d2f2e/index.js#L28
  // as for the types: since (as of @types/analytics-node v3.1.7) this is hardcoded into a class constructor, it makes it hard to fix with module augmentation
  axiosConfig,
});

const getDeviceId = async () => {
  const settings = await models.settings.getOrCreate();
  return settings.deviceId || (await models.settings.update(settings, { deviceId: uuidv4() })).deviceId;
};

const sendSegment = async function sendSegment<T extends 'track' | 'page'>(segmentType: T, options: Parameters<Analytics[T]>[0]) {
  try {
    const anonymousId = await getDeviceId() ?? undefined;
    const userId = getAccountId();
    const context = {
      app: { name: getProductName(), version: getAppVersion() },
      os: { name: _getOsName(), version: process.getSystemVersion() },
    };
    // HACK: TypeScript isn't capable (yet) of correlating Analytics[T] here with Parameters<Analytics[T]> in the arguments. Technically, the typing is correct here, TypeScript is just unable to check it.
    // See related issue microsoft/TypeScript#30581
    segmentClient?.[segmentType]({ ...options as {event: string}, context, anonymousId, userId }, error => {
      if (error) {
        console.warn('[analytics] Error sending segment event', error);
      }
    });
  } catch (error: unknown) {
    console.warn('[analytics] Unexpected error while sending segment event', error);
  }
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

/**
 * You may refer to this Segment API Document - https://segment.com/docs/connections/spec/track/#properties to understand what 'event properties' is for.
 *
 * The following properties are custom defined attributes for our own metrics purpose to help ourselves to make product decisions
 */
interface SegmentEventProperties {
  type: string;

  /**
   * a short description clarifying the specific action the user took
   * */
  action: string;

  /**
   * a description of an error that occured as a result of the user action
   * */
  error?: string;
}

type PushPull = 'push' | 'pull';
type VCSAction = PushPull | `force_${PushPull}` |
  'create_branch' | 'merge_branch' | 'delete_branch' | 'checkout_branch' |
  'commit' | 'stage_all' | 'stage' | 'unstage_all' | 'unstage' | 'rollback' | 'rollback_all' |
  'update' | 'setup' | 'clone';
export function vcsSegmentEventProperties(
  type: 'git',
  action: VCSAction,
  error?: string
): SegmentEventProperties {
  return { type, action, error };
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
      queuedEvents.push(queuedEvent);
    }
    return;
  }
  sendSegment('track', {
    event,
    properties,
    ...(timestamp ? { timestamp } : {}),
  });
}

export async function trackPageView(name: string) {
  const settings = await models.settings.getOrCreate();
  if (!settings.enableAnalytics) {
    return;
  }
  sendSegment('page', { name });
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
    const isUpdatingSettings = isSettings(doc) && event === 'update';
    if (isUpdatingSettings && doc.enableAnalytics) {
      await flushQueuedEvents();
    }
  }
});
