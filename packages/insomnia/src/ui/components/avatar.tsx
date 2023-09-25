import React, { Suspense } from 'react';
import styled, { keyframes } from 'styled-components';

import { Tooltip } from './tooltip';

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

const appearIn = keyframes`
  0% {
    opacity: 0;
    scale: 0.8;
  }

  50% {
    opacity: 1;
    scale: 1.1;
  }

  100% {
    opacity: 1;
    scale: 1;
  }
`;

const ImageElement = styled.img<{
  size: 'small' | 'medium';
  animate: boolean;
}>`
  border: 2px solid var(--color-bg);
  box-sizing: border-box;
  outline: none;
  border-radius: 50%;
  object-fit: cover;
  object-position: center;
  background-size: cover;
  background-position: center;
  animation: ${({ animate }) => (animate ? appearIn : 'none')} 0.2s ease-in-out;
  width: ${({ size }) => (size === 'small' ? '20px' : '24px')};
  height: ${({ size }) => (size === 'small' ? '20px' : '24px')};
`;

const AvatarImage = ({ src, alt, size, animate }: { src: string; alt: string; size: 'small' | 'medium'; animate: boolean }) => {
  imgCache.read(src);
  return <ImageElement animate={animate} alt={alt} src={src} size={size} />;
};

const AvatarPlaceholder = styled.div<{size: 'small' | 'medium'; animate: boolean}>`
  border: 2px solid var(--color-bg);
  box-sizing: border-box;
  outline: none;
  border-radius: 50%;
  width: ${({ size }) => size === 'small' ? '20px' : '24px'};
  height: ${({ size }) => size === 'small' ? '20px' : '24px'};
  object-fit: cover;
  object-position: center;
  background-size: cover;
  background-position: center;
  margin: 0!important;
  animation: ${({ animate }) => animate ? appearIn : 'none'} 0.2s ease-in-out;
  background-color: var(--color-surprise);
  color: var(--color-font-surprise);
  display: flex;
  margin-left: ${({ size }) => size === 'small' ? '-5px' : '-6px'};
  align-items: center;
  justify-content: center;
  font-size: ${({ size }) => size === 'small' ? 'var(--font-size-xxs)' : 'var(--font-size-xs)'};
  font-weight: bold;
`;

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

export const Avatar = ({ src, alt, size = 'medium', animate }: { src: string; alt: string; size?: 'small' | 'medium'; animate?: boolean }) => {
  if (!src) {
    return <AvatarPlaceholder animate={Boolean(animate)} size={size}>{getNameInitials(alt)}</AvatarPlaceholder>;
  }

  return (
    <Tooltip
      style={{
        display: 'flex',
        alignItems: 'center',
      }}
      message={alt}
    >
      <Suspense fallback={<AvatarPlaceholder animate={Boolean(animate)} size={size}>{getNameInitials(alt)}</AvatarPlaceholder>}>
        <AvatarImage
          animate={Boolean(animate)}
          src={src}
          alt={alt}
          size={size}
        />
      </Suspense>
    </Tooltip>
  );
};

export const AvatarGroup = ({ items, maxAvatars = 3, size = 'medium', animate = false }: { items: {src: string; alt: string}[]; maxAvatars?: number; size: 'small' | 'medium'; animate?: boolean }) => {
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
        {avatars.map((avatar, index) => (
          <Avatar
            size={size}
            key={index}
            animate={animate}
            src={avatar.src}
            alt={avatar.alt}
          />
        ))}
        {overflow > 0 && (
          <Tooltip
            message={
              items.slice(maxAvatars).map((avatar, index) => (
                <div key={index}>{avatar.alt}</div>
              ))
            }
          >
            <AvatarPlaceholder animate={animate} size={size}>{`+${overflow}`}</AvatarPlaceholder>
          </Tooltip>
        )}
      </div>
    </Suspense>
  );
};
