import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import classNames from 'classnames';
import type React from 'react';
import { Button as RAButton, type ButtonProps } from 'react-aria-components';

import { Icon } from './icon';

interface Props {
  type?: 'primary' | 'default' | 'info';
  size?: 's' | 'm' | 'l';
  loading?: boolean;
  icon?: IconProp | React.ReactElement;
}

export const Button: React.FC<React.PropsWithChildren<Props> & ButtonProps> = ({
  type = 'default',
  className = '',
  children,
  size = 'm',
  loading = false,
  icon,
  ...props
}) => {
  const clazzNames = classNames(
    'rounded-md inline-flex items-center box-border justify-center',
    {
      'bg-[--color-surprise] text-[--color-font-surprise] hover:brightness-90 focus:brightness-90': type === 'primary',
      'border border-solid border-[white]': type === 'default',
      'text-[--color-font-info] hover:brightness-90 focus:brightness-90': type === 'default',
      'h-8 px-3 text-sm': size === 's',
      'h-10 px-4': size === 'm',
      'h-11 px-5 text-base': size === 'l',
    },
    className,
  );
  const iconNode = loading ? (
    <i className="fa fa-spin fa-refresh mr-1" />
  ) : typeof icon === 'string' ? (
    <Icon icon={icon as IconProp} className="mr-1" />
  ) : (
    icon
  );
  return (
    <RAButton className={clazzNames} {...props}>
      {iconNode as React.ReactNode}
      {children}
    </RAButton>
  );
};
