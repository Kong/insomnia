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

export const Avatar = ({ src, alt, size = 'medium', animate }: { src: string; alt: string; size?: 'small' | 'medium'; animate?: boolean }) => {
  if (!src) {
    return <AvatarPlaceholder animate={Boolean(animate)} size={size}>{alt}</AvatarPlaceholder>;
  }

  return (
    <Tooltip
      style={{
        display: 'flex',
        alignItems: 'center',
      }}
      message={alt}
    >
      <Suspense fallback={<AvatarPlaceholder animate={Boolean(animate)} size={size}>{alt}</AvatarPlaceholder>}>
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
        style={{
          display: 'flex',
          alignItems: 'center',
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
