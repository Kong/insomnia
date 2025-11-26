import { forwardRef, type ReactNode } from 'react';
import { Button as RAButton, type ButtonProps as RAButtonProps } from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

import {
  type ButtonColor,
  getBackgroundColorClasses,
  getBorderColorClasses,
  getSizeClasses,
  getStateClasses,
  getTextColorClasses,
  type Size,
} from './utils';

interface Props {
  variant?: 'solid' | 'outlined' | 'text' | 'link';
  primary?: boolean;
  danger?: boolean;
  size?: Size;
  isLoading?: boolean;
  className?: string;
}

interface Slots {
  icon?: ReactNode;
  children?: ReactNode;
}

export type ButtonProps = Props & Slots & RAButtonProps;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, primary, danger, size, isLoading, icon, children, className, isDisabled, ...raProps },
  ref,
) {
  size = size || 'md';

  const classNames: string[] = [getSizeClasses(size), getStateClasses()];

  let color: ButtonColor;
  if (danger) {
    color = 'danger';
    variant = variant || 'solid';
  } else if (primary) {
    color = 'primary';
    variant = variant || 'solid';
  } else {
    color = variant === 'link' ? 'primary' : 'default';
  }

  variant = variant || 'outlined';

  classNames.push(getColorClasses(variant, color));

  return (
    <RAButton
      {...raProps}
      ref={ref}
      isDisabled={isDisabled || isLoading}
      type={raProps.type || 'button'}
      className={twMerge('inline-flex cursor-pointer items-center justify-center outline-none', classNames, className)}
    >
      {children}
      {!isLoading && icon}
    </RAButton>
  );
});

function getColorClasses(variant: string, color: ButtonColor) {
  if (variant === 'solid') {
    return `${getBackgroundColorClasses(color)} ${getTextColorClasses(color)}`;
  } else if (variant === 'outlined') {
    return `${getBorderColorClasses(color)} ${getTextColorClasses(color)}`;
  } else if (variant === 'link') {
    return getTextColorClasses(color);
  } else if (variant === 'text') {
    return `${getTextColorClasses(color)} data-hovered:bg-(--hl-xs)`;
  }
  return '';
}
