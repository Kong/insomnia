import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

import { Icon } from './icon';

interface WarningBannerProps {
  icon?: React.ComponentProps<typeof Icon>['icon'];
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export const WarningBanner = ({
  icon = 'triangle-exclamation',
  children,
  className,
  'data-testid': testId,
}: WarningBannerProps) => (
  <p
    data-testid={testId}
    className={twMerge(
      'flex items-start gap-2 rounded-sm border border-solid border-(--hl-md) bg-[rgba(var(--color-warning-rgb),0.5)] p-(--padding-sm) text-base',
      className,
    )}
  >
    <Icon icon={icon} className="mt-1 shrink-0" />
    <span>{children}</span>
  </p>
);
