import classnames from 'classnames';
import React, { FC, ReactNode } from 'react';

import { clickLink } from '../../../common/electron-helpers';

interface Props {
  href: string;
  title?: string;
  button?: boolean;
  onClick?: (...args: any[]) => any;
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  noTheme?: boolean;
}

export const Link: FC<Props> = props => {
  const _handleClick = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e?.preventDefault();
    const {
      href,
      onClick,
    } = props; // Also call onClick that was passed to us if there was one

    onClick?.(e);
    clickLink(href);
  };

  const {
    onClick,
    button,
    href,
    children,
    className,
    disabled,
    noTheme,
    ...other
  } = props;
  return button ? <button onClick={_handleClick} className={className} {...other}>
    {children}
  </button> : <a
    href={href}
    onClick={_handleClick}
    className={classnames(className, {
      'theme--link': !noTheme,
    })} // @ts-expect-error -- TSCONVERSION
    disabled={disabled}
    {...other}
  >
    {children}
  </a>;
};
