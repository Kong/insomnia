import { describe, expect, it } from 'vitest';

import { findSystemChangeLines } from '../../../common/significant-diff-detection';

// Helper to build a lineChangeIntervals entry
function buildInterval(start: number, end: number) {
  return { modifiedStartLineNumber: start, modifiedEndLineNumber: end };
}

describe('findSystemChangeLines()', () => {
  // Line 1: name: test
  // Line 2: meta:
  // Line 3:   id: abc
  // Line 4:   modified: 123
  // Line 5: value: hello
  //
  // meta key   → system interval {2, 2}
  // meta value → system interval {3, 4}
  const SIMPLE_YAML = `name: test
meta:
  id: abc
  modified: 123
value: hello`;

  it('returns empty array when no change intervals are provided', () => {
    expect(findSystemChangeLines(SIMPLE_YAML, [])).toEqual([]);
  });

  it('returns empty array when change interval does not overlap any meta lines', () => {
    // Line 1 is before meta (lines 2-4)
    expect(findSystemChangeLines(SIMPLE_YAML, [buildInterval(1, 1)])).toEqual([]);
    // Line 5 is after meta (lines 2-4)
    expect(findSystemChangeLines(SIMPLE_YAML, [buildInterval(5, 5)])).toEqual([]);
  });

  it('returns empty array when YAML has no meta key', () => {
    const yaml = `name: test\nvalue: hello`;
    expect(findSystemChangeLines(yaml, [buildInterval(1, 2)])).toEqual([]);
  });

  it('returns the full meta region when change interval fully contains it', () => {
    // Change covers lines 1–5; meta occupies lines 2–4.
    // Raw overlaps {2,2} and {3,4} are merged into {2,4}.
    expect(findSystemChangeLines(SIMPLE_YAML, [buildInterval(1, 5)])).toEqual([{ start: 2, end: 4 }]);
  });

  it('returns partial overlap when change starts before meta and ends inside it', () => {
    // Change [1, 3] overlaps meta key (line 2) and first value line (line 3)
    expect(findSystemChangeLines(SIMPLE_YAML, [buildInterval(1, 3)])).toEqual([{ start: 2, end: 3 }]);
  });

  it('returns partial overlap when change starts inside meta and ends after it', () => {
    // Change [3, 5] overlaps meta value lines 3–4 only
    expect(findSystemChangeLines(SIMPLE_YAML, [buildInterval(3, 5)])).toEqual([{ start: 3, end: 4 }]);
  });

  it('returns a single-line overlap when change covers only the meta key line', () => {
    // meta: is on line 2
    expect(findSystemChangeLines(SIMPLE_YAML, [buildInterval(2, 2)])).toEqual([{ start: 2, end: 2 }]);
  });

  it('merges adjacent result intervals produced by two separate change intervals', () => {
    // Change [2, 2] → overlap with meta key → {2, 2}
    // Change [3, 4] → overlap with meta value → {3, 4}
    // The two intervals are adjacent (2+1 === 3) and must be merged → {2, 4}
    expect(findSystemChangeLines(SIMPLE_YAML, [buildInterval(2, 2), buildInterval(3, 4)])).toEqual([
      { start: 2, end: 4 },
    ]);
  });

  it('handles nested meta keys inside a sequence', () => {
    // Line 1: requests:
    // Line 2:   - name: req1
    // Line 3:     meta:          ← meta key   {3,3}
    // Line 4:       id: r1       ← meta value {4,4}
    // Line 5:   - name: req2
    // Line 6:     meta:          ← meta key   {6,6}
    // Line 7:       id: r2       ← meta value {7,7}
    const yaml = `requests:\n  - name: req1\n    meta:\n      id: r1\n  - name: req2\n    meta:\n      id: r2`;

    // Change covering first meta only
    expect(findSystemChangeLines(yaml, [buildInterval(3, 4)])).toEqual([{ start: 3, end: 4 }]);

    // Change covering second meta only
    expect(findSystemChangeLines(yaml, [buildInterval(6, 7)])).toEqual([{ start: 6, end: 7 }]);

    // Non-meta lines produce no result
    expect(findSystemChangeLines(yaml, [buildInterval(2, 2)])).toEqual([]);
  });

  it('returns separate intervals when change intervals overlap different, non-adjacent meta regions', () => {
    // Line 1: requests:
    // Line 2:   - name: req1
    // Line 3:     meta:          ← {3,3}
    // Line 4:       id: r1       ← {4,4}
    // Line 5:   - name: req2
    // Line 6:     meta:          ← {6,6}
    // Line 7:       id: r2       ← {7,7}
    const yaml = `requests:\n  - name: req1\n    meta:\n      id: r1\n  - name: req2\n    meta:\n      id: r2`;
    const result = findSystemChangeLines(yaml, [buildInterval(3, 4), buildInterval(6, 7)]);
    expect(result).toEqual([
      { start: 3, end: 4 },
      { start: 6, end: 7 },
    ]);
  });

  it('returns empty array for empty YAML without crashing', () => {
    expect(findSystemChangeLines('', [buildInterval(1, 1)])).toEqual([]);
  });
});
