import type { AnalyticsEvent } from 'insomnia-analytics/events';

export { AnalyticsEvent } from 'insomnia-analytics/events';

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function hasTrackedToday(key: string): boolean {
  const lastTracked = localStorage.getItem(key);
  return lastTracked === getTodayDateString();
}

export function markTrackedToday(key: string): void {
  localStorage.setItem(key, getTodayDateString());
}

export function trackOnceDaily(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (hasTrackedToday(event)) {
    return;
  }
  window.main.trackAnalyticsEvent({ event, properties });
  markTrackedToday(event);
}

export interface ImportAttribution {
  importSource?: string;
  importSourceUrl?: string;
}

export const PENDING_IMPORT_ATTRIBUTION_KEY = 'pendingImportAttribution';

export const importAttributionKey = (requestId: string): string => `importAttribution:request:${requestId}`;

export function readPendingImportAttribution(): ImportAttribution {
  try {
    const raw = window.sessionStorage.getItem(PENDING_IMPORT_ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as ImportAttribution) : {};
  } catch {
    return {};
  }
}

export function trackImportEvent(event: AnalyticsEvent, properties: Record<string, unknown> = {}): void {
  window.main.trackAnalyticsEvent({
    event,
    properties: { ...readPendingImportAttribution(), ...properties },
  });
}

export interface RequestCreatedMetricsProperties {
  source:
    | 'sidebar'
    | 'shortcut'
    | 'tab-list'
    | 'placeholder-request-pane'
    | 'add-request-to-collection-modal'
    | 'home-page'
    | 'first-request-pane';
}
