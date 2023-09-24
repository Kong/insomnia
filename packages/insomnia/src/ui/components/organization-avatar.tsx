import React, { Suspense } from 'react';

const getNameInitials = (name: string) => {
  // Split on whitespace and take first letter of each word
  const words = name.toUpperCase().split(' ');
  const firstWord = words[0];
  const lastWord = words[words.length - 1];

  // If there is only one word, just take the first letter
  if (words.length === 1) {
    return firstWord.charAt(0);
  }

  // If the first word is an emoji or an icon then just use that
  const iconMatch = firstWord.match(/\p{Extended_Pictographic}/u);
  if (iconMatch) {
    return iconMatch[0];
  }

  return `${firstWord.charAt(0)}${lastWord ? lastWord.charAt(0) : ''}`;
};

// https://css-tricks.com/pre-caching-image-with-react-suspense/
// can be improved when api sends image expiry headers
class ImageCache {
  __cache: Record<string, { value: Promise<string> | string; timestamp: number }> = {};
  ttl: number;

  constructor({ ttl }: { ttl: number }) {
    this.ttl = ttl;
  }

  read(src: string) {
    const now = Date.now();
    if (this.__cache[src] && typeof this.__cache[src].value !== 'string') {
      // If the value is a Promise, throw it to indicate that the cache is still loading
      throw this.__cache[src].value;
    } else if (this.__cache[src] && now - this.__cache[src].timestamp < this.ttl) {
      // If the value is a string and hasn't expired, return it
      return this.__cache[src].value;
    } else {
      // Otherwise, load the image and add it to the cache
      const promise = new Promise<string>(resolve => {
        const img = new Image();
        img.onload = () => {
          const value = src;
          this.__cache[src] = { value, timestamp: now };
          resolve(value);
        };
        img.src = src;
      });
      this.__cache[src] = { value: promise, timestamp: now };
      throw promise;
    }
  }
}

// Cache images for 10 minutes
const imgCache = new ImageCache({ ttl: 1000 * 60 * 10 });

const Avatar = ({ src, alt }: { src: string; alt: string }) => {
  imgCache.read(src);
  return <img
    src={src}
    alt={alt}
    className='h-full w-full aspect-square object-cover'
    aria-label={alt}
  />;
};

export const OrganizationAvatar = ({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) => {
  if (!src) {
    return <div className='flex items-center justify-center w-full h-full p-[--padding-md]'>{getNameInitials(alt)}</div>;
  }

  return (
    <Suspense fallback={<div className='flex items-center justify-center w-full h-full p-[--padding-md]'>{getNameInitials(alt)}</div>}>
      <Avatar src={src} alt={alt} />
    </Suspense>
  );
};
