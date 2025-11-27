import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { twMerge } from 'tailwind-merge';

import { Icon } from './icon';

interface BannerProps {
  type: 'info' | 'warning';
  message: React.ReactNode;
  title?: string;
  className?: string;
}
const bannerTypeToIconName: Record<BannerProps['type'], IconProp> = {
  info: 'circle-info',
  warning: 'triangle-exclamation',
};
const bannerTypeToBgColor: Record<BannerProps['type'], string> = {
  info: 'bg-(--color-surprise)',
  warning: 'bg-(--color-warning)',
};
export const Banner = ({ type, title, message, className }: BannerProps) => {
  return (
    <div
      className={twMerge(
        `flex gap-4 rounded-sm p-4 ${bannerTypeToBgColor[type]} ${!title && 'items-center'}`,
        className,
      )}
    >
      <Icon icon={bannerTypeToIconName[type]} />
      <div className="leading-none">
        {title && <div className="mb-3 text-[16px] font-semibold">{title}</div>}
        <div>{message}</div>
      </div>
    </div>
  );
};
