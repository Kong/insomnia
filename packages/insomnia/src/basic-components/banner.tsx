import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { twMerge } from 'tailwind-merge';

import { Icon } from './icon';

interface BannerProps {
  type: 'info' | 'warning';
  message: React.ReactNode;
  footer?: React.ReactNode;
  title?: string;
  className?: string;
}
const bannerTypeToIconName: Record<BannerProps['type'], IconProp> = {
  info: 'circle-info',
  warning: 'triangle-exclamation',
};
const bannerTypeToBgColor: Record<BannerProps['type'], string> = {
  info: 'bg-(--color-surprise)',
  warning: 'bg-(--color-warning)/50',
};
export const Banner = ({ type, title, message, footer, className }: BannerProps) => {
  return (
    <div className={twMerge(`flex gap-4 rounded-sm p-4 leading-5 ${bannerTypeToBgColor[type]}`, className)}>
      <Icon icon={bannerTypeToIconName[type]} className="mt-1" />
      <div className="flex flex-col gap-3">
        {title && <div className="text-base font-semibold">{title}</div>}
        <div className="text-sm">{message}</div>
        {footer && <div>{footer}</div>}
      </div>
    </div>
  );
};
