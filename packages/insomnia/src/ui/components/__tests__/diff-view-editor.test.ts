import { describe, expect, it } from 'vitest';

import { findSystemChangeLines } from '../../../common/significant-diff-detection';

describe('findSystemChangeLines()', () => {
  it('should return empty arrays when original and modified are identical', () => {
    const content = `name: test
modified: 2024-01-01
value: 123`;

    const result = findSystemChangeLines(content, content);

    expect(result.originalLines).toEqual([]);
    expect(result.modifiedLines).toEqual([]);
  });

  it('should detect modified lines containing "modified" property', () => {
    const original = `name: test
modified: 2024-01-01
value: 123`;

    const modified = `name: test
modified: 2024-01-02
value: 123`;

    const result = findSystemChangeLines(original, modified);

    expect(result.originalLines).toEqual([2]);
    expect(result.modifiedLines).toEqual([2]);
  });

  it('should not mark pure additions as system changes', () => {
    const original = `name: test
value: 123`;

    const modified = `name: test
modified: 2024-01-01
value: 123`;

    const result = findSystemChangeLines(original, modified);

    // Pure addition - should not be marked as system change
    expect(result.originalLines).toEqual([]);
    expect(result.modifiedLines).toEqual([]);
  });

  it('should not mark pure deletions as system changes', () => {
    const original = `name: test
modified: 2024-01-01
value: 123`;

    const modified = `name: test
value: 123`;

    const result = findSystemChangeLines(original, modified);

    // Pure deletion - should not be marked as system change
    expect(result.originalLines).toEqual([]);
    expect(result.modifiedLines).toEqual([]);
  });

  it('should handle multiple modified lines with "modified" property', () => {
    const original = `item1:
  name: test1
  modified: 2024-01-01
item2:
  name: test2
  modified: 2024-01-01`;

    const modified = `item1:
  name: test1
  modified: 2024-01-02
item2:
  name: test2
  modified: 2024-01-02`;

    const result = findSystemChangeLines(original, modified);

    expect(result.originalLines).toEqual([3, 6]);
    expect(result.modifiedLines).toEqual([3, 6]);
  });

  it('should only mark lines containing "modified" keyword in modifications', () => {
    const original = `name: test
modified: 2024-01-01
description: old description`;

    const modified = `name: test
modified: 2024-01-02
description: new description`;

    const result = findSystemChangeLines(original, modified);

    // Only the "modified" line should be marked, not the description line
    expect(result.originalLines).toEqual([2]);
    expect(result.modifiedLines).toEqual([2]);
  });

  it('should handle empty strings', () => {
    const result = findSystemChangeLines('', '');

    expect(result.originalLines).toEqual([]);
    expect(result.modifiedLines).toEqual([]);
  });

  it('should handle modification where line count changes', () => {
    const original = `name: test
modified: 2024-01-01`;

    const modified = `name: test
modified: 2024-01-02
extra: line`;

    const result = findSystemChangeLines(original, modified);

    // The "modified" line was modified (not just added)
    expect(result.originalLines).toEqual([2]);
    expect(result.modifiedLines).toEqual([2]);
  });

  it('should not match partial word "modified" in other words', () => {
    const original = `name: test
unmodified: value1`;

    const modified = `name: test
unmodified: value2`;

    const result = findSystemChangeLines(original, modified);

    // "unmodified" should not match the word boundary regex for "modified"
    expect(result.originalLines).toEqual([]);
    expect(result.modifiedLines).toEqual([]);
  });
});
