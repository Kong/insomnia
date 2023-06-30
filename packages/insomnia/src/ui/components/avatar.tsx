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

export const AvatarImage = styled.div`
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

const imgCache = {
  __cache: {},
  read(src) {
    if (!this.__cache[src]) {
      this.__cache[src] = new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          this.__cache[src] = true;
          resolve(this.__cache[src]);
        };
        img.src = src;
      }).then(img => {
        this.__cache[src] = true;
      });
    }
    if (this.__cache[src] instanceof Promise) {
      throw this.__cache[src];
    }
    return this.__cache[src];
  },
};

export const Avatar = ({ src, alt, style }: { src: string; alt: string }) => {
  console.log(imgCache);
  if (!src) {
    return <AvatarPlaceholder size="medium">{alt}</AvatarPlaceholder>;
  }
  imgCache.read(src);
  return (
    <Tooltip message={alt}>
      <AvatarImage
        style={{
          backgroundImage: `url(${src})`,
          ...style,
        }}
      />
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
            style={{
              marginLeft: size === 'small' ? '-5px' : '-6px',
              width: size === 'small' ? '20px' : '24px',
              height: size === 'small' ? '20px' : '24px',
            }}
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
