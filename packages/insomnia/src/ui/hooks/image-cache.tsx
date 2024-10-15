import { useSyncExternalStore } from 'react';

interface CacheEntry {
  value: Promise<string> | string;
  timestamp: number;
  subscribers: (() => void)[];
}

// Adopted from https://css-tricks.com/pre-caching-image-with-react-suspense/
class ImageCache {
  __cache: Record<string, CacheEntry> = {};
  ttl: number;

  constructor({ ttl }: { ttl: number }) {
    this.ttl = ttl;
  }

  read(src: string) {
    const now = Date.now();
    if (this.__cache[src] && this.__cache[src].value instanceof Promise) {
      // If the value is a Promise, throw it to indicate that the cache is still loading
      throw this.__cache[src].value;
    } else if (this.__cache[src] && now - this.__cache[src].timestamp < this.ttl) {
      // If the value is an HTMLImageElement and hasn't expired, return it
      return this.__cache[src].value;
    } else {
      // Otherwise, load the image and add it to the cache
      const promise = new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.__cache[src] = { value: src, timestamp: now, subscribers: [] };
          resolve(src);
          // Notify all subscribers
          this.__cache[src].subscribers.forEach(callback => callback());
        };
        img.onerror = () => {
          reject(new Error(`Failed to load image: ${src}`));
          // Remove the cache entry if the image fails to load
          delete this.__cache[src];
        };
        img.src = src;
      });
      this.__cache[src] = { value: promise, timestamp: now, subscribers: [] };
      throw promise;
    }
  }

  subscribe(src: string, callback: () => void) {
    if (!this.__cache[src]) {
      this.__cache[src] = { value: new Promise(() => { }), timestamp: 0, subscribers: [] };
    }
    this.__cache[src].subscribers.push(callback);

    return () => {
      this.__cache[src].subscribers = this.__cache[src].subscribers.filter(cb => cb !== callback);
    };
  }

  invalidate(src: string) {
    if (this.__cache[src]) {
      delete this.__cache[src];
      this.read(src);
    }
  }

  invalidateAll() {
    Object.keys(this.__cache).forEach(src => this.invalidate(src));
  }
}

function useImageCache(src: string, cache: ImageCache): string {

  const subscribe = (callback: () => void) => {
    return cache.subscribe(src, callback);
  };

  const getSnapshot = () => {
    return cache.read(src);
  };

  const getServerSnapshot = () => src;

  cache.read(src);

  const image = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (image instanceof Promise) {
    throw image;
  }

  if (typeof image === 'string') {
    return image;
  }

  return src;
};

export const avatarImageCache = new ImageCache({
  ttl: 10 * 60 * 1000, // 10 minutes
});

export function useAvatarImageCache(src: string) {
  return useImageCache(src, avatarImageCache);
}
