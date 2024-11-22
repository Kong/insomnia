import { describe, expect, it } from 'vitest';

import { VaultCache } from '../cloud-service-integraion/vault-cache';

describe('test cache', () => {
  it('should get item after set', () => {
    const cacheInstance = new VaultCache();
    cacheInstance.setItem('foo', 'bar');
    cacheInstance.setItem('number_key', Math.random() * 1000);
    cacheInstance.setItem('boolean_key', true);

    expect(cacheInstance.has('foo')).toBe(true);
    expect(cacheInstance.has('boolean_key')).toBe(true);
    expect(cacheInstance.has('foo1')).toBe(false);
    expect(cacheInstance.getItem('foo')).toBe('bar');

    cacheInstance.clear();
    expect(Array.from(cacheInstance.entriesAscending()).length).toBe(0);

  });

});
