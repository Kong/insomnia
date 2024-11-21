import QuickLRU from 'quick-lru';

export interface VaultCacheOptions {
  maxSize?: number;
  maxAge?: number;
}
export type MaxAgeUnit = 'ms' | 's' | 'min' | 'h';

// convert time unit to milliseconds
export const timeToMs = (time: number, unit: MaxAgeUnit = 'ms') => {
  if (typeof time === 'number' && time > 0) {
    switch (unit) {
      case 'ms':
        return time;
      case 's':
        return time * 1000;
      case 'min':
        return time * 1000 * 60;
      case 'h':
        return time * 1000 * 60 * 60;
      default:
        return time;
    }
  }
  return 0;
};

export class VaultCache<K = string, T = any> {
  _cache: QuickLRU<K, T>;
  // The maximum number of milliseconds an item should remain in cache, default 30 mins
  _maxAge: number = 30 * 60 * 1000;

  constructor(options?: VaultCacheOptions) {
    const { maxSize = 1000, maxAge } = options || {};
    this._maxAge = maxAge || this._maxAge;
    this._cache = new QuickLRU({ maxSize, maxAge: this._maxAge });
  }

  has(key: K) {
    return this._cache.has(key);
  }

  setItem(key: K, value: T, options?: Pick<Required<VaultCacheOptions>, 'maxAge'>) {
    const { maxAge = this._maxAge } = options || {};
    this._cache.set(key, value, { maxAge });
  }

  getItem(key: K) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }
    return null;
  }

  getKeys() {
    return Array.from(this._cache.keys());
  }

  getValues() {
    return Array.from(this._cache.values());
  }

  entriesAscending() {
    return this._cache.entriesAscending();
  }

  entriesDescending() {
    return this._cache.entriesDescending();
  }

  deleteItem(key: K) {
    if (this._cache.has(key)) {
      this._cache.delete(key);
    }
  }

  resize(newSize: number) {
    if (newSize > 0) {
      this._cache.resize(newSize);
    } else {
      throw Error('cache size must be positive number');
    }
  }

  setMaxAge(maxAge: number, unit: MaxAgeUnit = 'ms') {
    this._maxAge = timeToMs(maxAge, unit);
  }

  clear() {
    this._cache.clear();
  }

  getSize() {
    return this._cache.size;
  }

};
