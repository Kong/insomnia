import { InsoEvent } from 'insomnia-analytics';

export { InsoEvent };

// Telemetry is removed. These stay as no-ops so existing call sites need no changes.
export const trackInsoEvent = async (_event: InsoEvent, _properties?: Record<string, unknown>): Promise<void> => {};

export const flushAnalytics = async (): Promise<void> => {};
