import { describe, expect, it } from 'vitest';

import {
  DISMISS_SNOOZE_DAYS,
  MS_PER_DAY,
  NOT_RIGHT_NOW_SNOOZE_DAYS,
  shouldShowSignUpTip,
} from '../scratchpad-tutorial-pane';

describe('shouldShowSignUpTip', () => {
  const now = 1_000_000_000_000;

  it('shows the tip when never dismissed or state is missing', () => {
    expect(shouldShowSignUpTip(undefined, now)).toBe(true);
    expect(shouldShowSignUpTip({ dismissed: false, dismissedAt: 0 }, now)).toBe(true);
  });

  it('falls back to the default snooze for legacy values without snoozeDays', () => {
    expect(shouldShowSignUpTip({ dismissed: true, dismissedAt: now - DISMISS_SNOOZE_DAYS * MS_PER_DAY + 1 }, now)).toBe(false);
    expect(shouldShowSignUpTip({ dismissed: true, dismissedAt: now - DISMISS_SNOOZE_DAYS * MS_PER_DAY }, now)).toBe(true);
  });

  it('honors the 14 day and 120 day snoozes', () => {
    const short = { dismissed: true, snoozeDays: DISMISS_SNOOZE_DAYS };
    const long = { dismissed: true, snoozeDays: NOT_RIGHT_NOW_SNOOZE_DAYS };
    expect(shouldShowSignUpTip({ ...short, dismissedAt: now - 13 * MS_PER_DAY }, now)).toBe(false);
    expect(shouldShowSignUpTip({ ...short, dismissedAt: now - 14 * MS_PER_DAY }, now)).toBe(true);
    expect(shouldShowSignUpTip({ ...long, dismissedAt: now - 119 * MS_PER_DAY }, now)).toBe(false);
    expect(shouldShowSignUpTip({ ...long, dismissedAt: now - 120 * MS_PER_DAY }, now)).toBe(true);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY, '120' as unknown as number])(
    'falls back to the default for invalid snoozeDays %s',
    snoozeDays => {
      expect(shouldShowSignUpTip({ dismissed: true, dismissedAt: now - MS_PER_DAY, snoozeDays }, now)).toBe(false);
      expect(shouldShowSignUpTip({ dismissed: true, dismissedAt: now - 15 * MS_PER_DAY, snoozeDays }, now)).toBe(true);
    },
  );
});
