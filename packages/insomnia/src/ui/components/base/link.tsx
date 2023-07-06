import classnames from 'classnames';
import React, { FC, ReactNode, useCallback } from 'react';

interface Props {
  href: string;
  title?: string;
  button?: boolean;
  onClick?: (...args: any[]) => any;
  className?: string;
  children?: ReactNode;
  noTheme?: boolean;
}

export const Link: FC<Props> = ({
  onClick,
  button,
  href,
  children,
  className,
  noTheme,
  ...other
}) => {
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    event?.preventDefault();
    onClick?.(event); // Also call onClick that was passed to us if there was one
    window.main.openInBrowser(href);
  }, [onClick, href]);

  if (button) {
    return (
      <button onClick={handleClick} className={className} {...other}>
        {children}
      </button>
    );
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={classnames(className, {
        'theme--link': !noTheme,
      })}
      {...other}
    >
      {children}
    </a>
  );
};
