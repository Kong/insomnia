// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { dismissResponseHistoryHint, isResponseHistoryHintDismissed } from './response-history-hint';

describe('hint dismissal', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('persists across reads once dismissed', () => {
    expect(isResponseHistoryHintDismissed()).toBe(false);
    dismissResponseHistoryHint();
    expect(isResponseHistoryHintDismissed()).toBe(true);
  });

  it('reports not dismissed when storage throws', () => {
    const getItem = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error('storage disabled');
    };
    try {
      expect(isResponseHistoryHintDismissed()).toBe(false);
    } finally {
      window.localStorage.getItem = getItem;
    }
  });

  it('does not throw when storage rejects the write', () => {
    const setItem = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error('quota exceeded');
    };
    try {
      expect(() => dismissResponseHistoryHint()).not.toThrow();
    } finally {
      window.localStorage.setItem = setItem;
    }
  });
});
