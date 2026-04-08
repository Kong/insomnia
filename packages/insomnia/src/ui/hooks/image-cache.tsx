import { useCallback, useSyncExternalStore } from 'react';

interface CacheEntry {
  value: Promise<string> | string;
  timestamp: number;
  version?: string;
  subscribers: (() => void)[];
}

// Adopted from https://css-tricks.com/pre-caching-image-with-react-suspense/
class ImageCache {
  __cache: Record<string, CacheEntry> = {};
  ttl: number;

  constructor({ ttl }: { ttl: number }) {
    this.ttl = ttl;
  }

  notifySubscribers(base: string) {
    this.__cache[base]?.subscribers.forEach(callback => callback());
  }

  read(base: string, version = ''): string {
    const value = `${base}${version ? `?${version}` : ''}`;
    const now = Date.now();
    const existingEntry = this.__cache[base];

    if (existingEntry && existingEntry.value instanceof Promise) {
      // If the value is a Promise, throw it to indicate that the cache is still loading
      throw existingEntry.value;
    } else if (existingEntry && (existingEntry.version === version || now - existingEntry.timestamp < this.ttl)) {
      return existingEntry.value as string;
    } else {
      // Otherwise, load the image and add it to the cache
      const entry = existingEntry || {
        value,
        timestamp: now,
        version,
        subscribers: [],
      };
      this.__cache[base] = entry;

      const promise = new Promise<string>(resolve => {
        const img = new Image();
        img.onload = () => {
          entry.value = value;
          entry.timestamp = Date.now();
          entry.version = version;
          resolve(value);
          this.notifySubscribers(base);
        };
        img.onerror = () => {
          // Leave the pending promise unresolved so Suspense stays on the fallback UI.
        };
        img.src = value;
      });

      entry.value = promise;
      entry.timestamp = now;
      entry.version = version;
      throw promise;
    }
  }

  subscribe(base: string, callback: () => void) {
    if (!this.__cache[base]) {
      this.__cache[base] = {
        value: new Promise(() => {}),
        timestamp: 0,
        subscribers: [],
      };
    }
    if (!this.__cache[base].subscribers) {
      this.__cache[base].subscribers = [];
    }
    if (!this.__cache[base].subscribers.includes(callback)) {
      this.__cache[base].subscribers.push(callback);
    }
    return () => {
      if (this.__cache[base] && this.__cache[base].subscribers) {
        this.__cache[base].subscribers = this.__cache[base].subscribers.filter(cb => cb !== callback);
      }
    };
  }

  invalidate(src: string) {
    const [base, version] = src.split('?');
    const entry = this.__cache[base];

    if (entry && entry.version !== version) {
      entry.timestamp = 0;
      entry.version = undefined;
      this.notifySubscribers(base);
    }
  }

  invalidateAll() {
    Object.keys(this.__cache).forEach(src => this.invalidate(src));
  }
}

export function useImageCache(src: string, cache: ImageCache): string {
  const [base, version] = src.split('?');

  const subscribe = useCallback(
    (callback: () => void) => {
      return cache.subscribe(base, callback);
    },
    [base, cache],
  );

  const getSnapshot = (): string => {
    try {
      return cache.read(base, version);
    } catch (maybePromise) {
      if (maybePromise instanceof Promise) {
        throw maybePromise;
      }
      return src;
    }
  };

  const getServerSnapshot = (): string => src;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const avatarImageCache = new ImageCache({
  ttl: 10 * 60 * 1000, // 10 minutes
});

export function useAvatarImageCache(src: string) {
  return useImageCache(src, avatarImageCache);
}
