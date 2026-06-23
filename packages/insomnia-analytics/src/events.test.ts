import { describe, expect, it } from 'vitest';

import { AnalyticsEvent, InsoEvent } from './events';

describe('events', () => {
  it('AnalyticsEvent has expected entries', () => {
    expect(AnalyticsEvent.appStarted).toBe('App Started');
    expect(AnalyticsEvent.unitTestRun).toBe('Ran Individual Unit Test');
    expect(AnalyticsEvent.installPlugin).toBe('Plugin Installed');
  });

  it('InsoEvent prefixes with inso_', () => {
    expect(InsoEvent.runTest).toBe('inso_run_test');
    expect(InsoEvent.script).toBe('inso_script');
  });
});
