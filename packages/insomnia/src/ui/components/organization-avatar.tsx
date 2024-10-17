import React from 'react';

import { useGloballyCachedImage } from '../context/app/global-image-cache-context';

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

const Avatar = ({ src, alt }: { src: string; alt: string }) => {
  const cachedImage = useGloballyCachedImage(src);
  return (
    <img
      alt={alt}
      src={cachedImage.url}
      className="h-full w-full aspect-square object-cover"
      aria-label={alt}
    />
  );
};

export const OrganizationAvatar = ({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) => {
  if (!src) {
    return (
      <div className="flex items-center justify-center w-full h-full p-[--padding-md]">
        {getNameInitials(alt)}
      </div>
    );
  }

  return <Avatar src={src} alt={alt} />;
};
