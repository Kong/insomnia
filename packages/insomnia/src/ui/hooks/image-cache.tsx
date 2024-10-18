import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

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

  read(base: string, version: string) {
    const value = `${base}${version ? `?${version}` : ''}`;
    const now = Date.now();
    if (this.__cache[base] && this.__cache[base].value instanceof Promise) {
      // If the value is a Promise, throw it to indicate that the cache is still loading
      throw this.__cache[base].value;
    } else if (
      this.__cache[base] &&
      (this.__cache[base].version === version ||
        now - this.__cache[base].timestamp < this.ttl)
    ) {
      // If the value is an HTMLImageElement, the version matches, and hasn't expired, return it
      return this.__cache[base].value;
    } else {
      // Otherwise, load the image and add it to the cache
      const promise = new Promise<string>(resolve => {
        const img = new Image();
        img.onload = () => {
          if (!this.__cache[base]) {
            this.__cache[base] = {
              value,
              timestamp: now,
              version,
              subscribers: [],
            };
          } else {
            this.__cache[base].value = value;
            this.__cache[base].timestamp = now;
            this.__cache[base].version = version;
          }
          resolve(value);
          // Notify all subscribers
          if (!this.__cache[base].subscribers) {
            this.__cache[base].subscribers = [];
          }
          this.__cache[base].subscribers.forEach(callback => callback());
        };
        img.onerror = () => {
          // infinitely suspended if the image fails to load
          this.__cache[base].value = new Promise(() => {});
          throw this.__cache[base].value;
        };
        img.src = value;
      });
      this.__cache[base].value = promise;
      this.__cache[base].timestamp = now;
      this.__cache[base].version = version;
      if (!this.__cache[base].subscribers) {
        this.__cache[base].subscribers = [];
      }
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
        this.__cache[base].subscribers = this.__cache[base].subscribers.filter(
          cb => cb !== callback
        );
      }
    };
  }

  invalidate(src: string) {
    const [base, version] = src.split('?');
    if (this.__cache[base] && this.__cache[base].version !== version) {
      this.__cache[base].timestamp = 0;
      this.read(base, version);
    }
  }

  invalidateAll() {
    Object.keys(this.__cache).forEach(src => this.invalidate(src));
  }
}

export function useImageCache(src: string, cache: ImageCache): string {
  const [base, version] = src.split('?');
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const subscribe = useCallback(
    (callback: () => void) => {
      return cache.subscribe(base, callback);
    },
    [base, cache]
  );

  const getSnapshot = () => {
    try {
      return cache.read(base, version);
    } catch (promise) {
      if (promise instanceof Promise) {
        throw promise;
      }
      return null;
    }
  };

  const getServerSnapshot = () => null;

  useEffect(() => {
    setImageSrc(() => {
      try {
        const result = cache.read(base, version);
        if (result instanceof Promise) {
          throw result;
        }

        return result;
      } catch (maybeResultPromise) {
        if (maybeResultPromise instanceof Promise) {
          throw maybeResultPromise;
        }
        return null;
      }
    });
  }, [cache, base, version]);

  const cacheSrc = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  if (typeof cacheSrc === 'string') {
    return cacheSrc;
  }

  return imageSrc!;
}

export const avatarImageCache = new ImageCache({
  ttl: 10 * 60 * 1000, // 10 minutes
});

export function useAvatarImageCache(src: string) {
  return useImageCache(src, avatarImageCache);
}
