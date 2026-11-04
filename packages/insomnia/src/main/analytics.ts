import type { AnalyticsEvent } from 'insomnia-analytics/events';

export { AnalyticsEvent } from 'insomnia-analytics/events';

// Telemetry is removed. These stay as no-ops so existing call sites need no changes.
export function setCurrentOrganizationId(_id: string | undefined): void {}

export async function trackAnalyticsEvent(_event: AnalyticsEvent, _properties?: Record<string, any>) {}

export async function trackPageView(_name: string) {}
