import React, { type ReactNode, Suspense } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';

import { useAvatarImageCache } from '../hooks/image-cache';

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

const AvatarImage = ({ src, alt, size }: { src: string; alt: string; size: 'small' | 'medium' }) => {
  const imageUrl = useAvatarImageCache(src);
  return (
    <img
      alt={alt}
      src={imageUrl}
      width={size === 'small' ? 20 : 24}
      height={size === 'small' ? 20 : 24}
      className={
        'bounce-in box-border rounded-full border-2 border-solid border-[--color-bg] bg-[--hl] object-cover object-center outline-none'
      }
    />
  );
};

const AvatarPlaceholder = ({ size, children }: { size: 'small' | 'medium'; children: ReactNode }) => {
  return (
    <div
      className={`m-0 box-border rounded-full border-2 border-solid border-[--color-bg] bg-[--color-surprise] bg-cover bg-center object-cover object-center text-[--color-font-surprise] outline-none ${size === 'small' ? 'h-[20px] w-[20px]' : 'h-[24px] w-[24px]'} flex items-center justify-center text-xs font-bold`}
    >
      {children}
    </div>
  );
};

export const Avatar = ({ src, alt, size = 'medium' }: { src: string; alt: string; size?: 'small' | 'medium' }) => {
  return src ? (
    <Suspense fallback={<AvatarPlaceholder size={size}>{getNameInitials(alt)}</AvatarPlaceholder>}>
      <AvatarImage src={src} alt={alt} size={size} />
    </Suspense>
  ) : (
    <AvatarPlaceholder size={size}>{getNameInitials(alt)}</AvatarPlaceholder>
  );
};

export const AvatarGroup = ({
  items,
  maxAvatars = 3,
  size = 'medium',
}: {
  items: { key: string; src: string; alt: string }[];
  maxAvatars?: number;
  size: 'small' | 'medium';
}) => {
  const avatars = items.slice(0, maxAvatars);
  const overflow = items.length - maxAvatars;

  return (
    <Suspense fallback={<div />}>
      <div
        className="flex flex-shrink-0 items-center -space-x-2"
        style={{
          paddingLeft: size === 'small' ? '5px' : '6px',
        }}
      >
        {avatars.map(avatar => (
          <TooltipTrigger key={avatar.key}>
            <Button className="cursor-default">
              <Avatar size={size} src={avatar.src} alt={avatar.alt} />
            </Button>
            <Tooltip
              offset={8}
              className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
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
              className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
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
