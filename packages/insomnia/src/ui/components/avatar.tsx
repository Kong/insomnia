import React, { Suspense } from 'react';
import styled, { keyframes } from 'styled-components';

import { Tooltip } from './tooltip';

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

const ImageElement = styled.img`
  border: 2px solid var(--color-bg);
  box-sizing: border-box;
  outline: none;
  border-radius: 50%;
  object-fit: cover;
  object-position: center;
  background-size: cover;
  background-position: center;
  animation: ${appearIn} 0.2s ease-in-out;
`;

const AvatarImage = ({ src, alt, size }: { src: string; alt: string; size: 'small' | 'medium' }) => {
  imgCache.read(src);
  return <ImageElement alt={alt} src={src} style={{ width: size === 'small' ? '20px' : '24px', height: size === 'small' ? '20px' : '24px' }} />;
};

const AvatarPlaceholder = styled.div<{size: 'small' | 'medium'}>`
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
  animation: ${appearIn} 0.2s ease-in-out;
  background-color: var(--color-surprise);
  color: var(--color-font);
  display: flex;
  margin-left: ${({ size }) => size === 'small' ? '-5px' : '-6px'};
  align-items: center;
  justify-content: center;
  font-size: ${({ size }) => size === 'small' ? 'var(--font-size-xxs)' : 'var(--font-size-xs)'};
  font-weight: bold;
`;

class ImageCache {
  __cache: Record<string, Promise<string> | string> = {};

  read(src: string) {
    if (!this.__cache[src]) {
      this.__cache[src] = new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          this.__cache[src] = src;
          resolve(this.__cache[src]);
        };
        img.src = src;
      });
    }
    if (this.__cache[src] instanceof Promise) {
      throw this.__cache[src];
    }
    return this.__cache[src];
  }
}

const imgCache = new ImageCache();

export const Avatar = ({ src, alt, size }: { src: string; alt: string; size?: 'small' | 'medium' }) => {
  if (!src) {
    return <AvatarPlaceholder size="medium">{alt}</AvatarPlaceholder>;
  }

  return (
    <Tooltip message={alt}>
      <Suspense fallback={<AvatarPlaceholder size="medium">{alt}</AvatarPlaceholder>}>
        <AvatarImage
          src={src}
          alt={alt}
          size={size || 'small'}
        />
      </Suspense>
    </Tooltip>
  );
};

export const AvatarGroup = ({ items, maxAvatars = 3, size = 'small' }: { items: {src: string; alt: string}[]; maxAvatars?: number; size: 'small' | 'medium' }) => {
  const avatars = items.slice(0, maxAvatars);
  const overflow = items.length - maxAvatars;

  return (
    <Suspense fallback={<div />}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: size === 'small' ? '5px' : '6px',
        }}
      >
        {avatars.map((avatar, index) => (
          <Avatar
            size="medium"
            key={index}
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
            <AvatarPlaceholder size={size}>{`+${overflow}`}</AvatarPlaceholder>
          </Tooltip>
        )}
      </div>
    </Suspense>
  );
};
