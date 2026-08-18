import { describe, expect, it } from 'vitest';

import { dedupeCollectionItems } from './dedupe-collection-items';

describe('dedupeCollectionItems', () => {
  it('keeps the first occurrence of each id and preserves order', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: 'c' }];

    const result = dedupeCollectionItems(items, item => item.id);

    expect(result.map(i => i.id)).toEqual(['a', 'b', 'c']);
    expect(result[0]).toBe(items[0]);
  });

  it('returns the same array reference when there are no duplicates', () => {
    const items = [{ id: 'a' }, { id: 'b' }];

    expect(dedupeCollectionItems(items, item => item.id)).toBe(items);
  });
});
