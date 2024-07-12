import React, { ReactNode, Suspense } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';

const getNameInitials = (name?: string) => {
  // Split on whitespace and take first letter of each word
  const words = name?.toUpperCase().split(' ') || [];
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

// The Image component will Suspend while the image is loading if it's not available in the cache
const AvatarImage = ({ src, alt, size }: { src: string; alt: string; size: 'small' | 'medium' }) => {
  imgCache.read(src);
  return (
    <img
      alt={alt}
      src={src}
      width={size === 'small' ? 20 : 24}
      height={size === 'small' ? 20 : 24}
      className={'border-2 bounce-in border-solid border-[--color-bg] box-border outline-none rounded-full object-cover object-center bg-cover bg-center'}
    />
  );
};

const AvatarPlaceholder = ({ size, children }: { size: 'small' | 'medium'; children: ReactNode }) => {
  return (
    <div
      className={`border-2 border-solid border-[--color-bg] box-border outline-none rounded-full object-cover object-center bg-cover bg-center m-0 bg-[--color-surprise] text-[--color-font-surprise] ${size === 'small' ? 'w-[20px] h-[20px]' : 'w-[24px] h-[24px]'} flex items-center justify-center font-bold text-xs`}
    >
      {children}
    </div>
  );
};

export const Avatar = ({ src, alt, size = 'medium' }: { src: string; alt: string; size?: 'small' | 'medium' }) => {
  return src ? (
    <Suspense fallback={<AvatarPlaceholder size={size}>{getNameInitials(alt)}</AvatarPlaceholder>}>
      <AvatarImage
        src={src}
        alt={alt}
        size={size}
      />
    </Suspense>
  ) : (
    <AvatarPlaceholder size={size}>
      {getNameInitials(alt)}
    </AvatarPlaceholder>
  );
};

export const AvatarGroup = ({ items, maxAvatars = 3, size = 'medium' }: { items: { key: string; src: string; alt: string }[]; maxAvatars?: number; size: 'small' | 'medium' }) => {
  const avatars = items.slice(0, maxAvatars);
  const overflow = items.length - maxAvatars;

  return (
    <Suspense fallback={<div />}>
      <div
        className='flex items-center flex-shrink-0 -space-x-2'
        style={{
          paddingLeft: size === 'small' ? '5px' : '6px',
        }}
      >
        {avatars.map(avatar => (
          <TooltipTrigger key={avatar.key}>
            <Button className="cursor-default">
              <Avatar
                size={size}
                src={avatar.src}
                alt={avatar.alt}
              />
            </Button>
            <Tooltip
              offset={8}
              className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
            >
              {avatar.alt}
            </Tooltip>
          </TooltipTrigger>
        ))}
        {overflow > 0 && (
          <TooltipTrigger>
            <Button className="cursor-default">
              <AvatarPlaceholder size={size}>{`+${overflow}`}</AvatarPlaceholder>
            </Button>
            <Tooltip
              offset={8}
              className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
            >
              {items.slice(maxAvatars).map(avatar => (
                <div key={avatar.key}>{avatar.alt}</div>
              ))}
            </Tooltip>
          </TooltipTrigger>
        )}
      </div>
    </Suspense>
  );
};
