// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import {
  dismissResponseHistoryHint,
  isResponseHistoryHintDismissed,
  shouldShowResponseHistoryHint,
} from './response-history-hint';

const base = {
  previousRequestId: 'req_1',
  requestId: 'req_1',
  previousActiveResponseId: 'res_1',
  activeResponseId: 'res_1',
  previousModified: 1000,
  modified: 2000,
  hasRestorableHistory: true,
  hintDismissed: false,
  alreadyShown: false,
};

describe('shouldShowResponseHistoryHint', () => {
  it('shows when the user edits a request that has a restorable snapshot', () => {
    expect(shouldShowResponseHistoryHint(base)).toBe(true);
  });

  it('stays hidden when switching to another request', () => {
    expect(shouldShowResponseHistoryHint({ ...base, previousRequestId: 'req_0' })).toBe(false);
  });

  it('stays hidden when the shown response changes, as every restore does', () => {
    expect(shouldShowResponseHistoryHint({ ...base, previousActiveResponseId: 'res_0' })).toBe(false);
  });

  it('stays hidden when the request was not modified', () => {
    expect(shouldShowResponseHistoryHint({ ...base, modified: base.previousModified })).toBe(false);
  });

  it('stays hidden when no response can restore a request', () => {
    expect(shouldShowResponseHistoryHint({ ...base, hasRestorableHistory: false })).toBe(false);
  });

  it('stays hidden when the hint was dismissed', () => {
    expect(shouldShowResponseHistoryHint({ ...base, hintDismissed: true })).toBe(false);
  });

  it('stays hidden once it was shown in this session', () => {
    expect(shouldShowResponseHistoryHint({ ...base, alreadyShown: true })).toBe(false);
  });
});

describe('hint dismissal', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('persists across reads once dismissed', () => {
    expect(isResponseHistoryHintDismissed()).toBe(false);
    dismissResponseHistoryHint();
    expect(isResponseHistoryHintDismissed()).toBe(true);
  });
});
