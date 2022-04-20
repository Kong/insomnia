import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
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

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Link extends PureComponent<Props> {
  _handleClick(e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) {
    e?.preventDefault();
    const { href, onClick } = this.props;
    // Also call onClick that was passed to us if there was one
    onClick?.(e);
    clickLink(href);
  }

  render() {
    const {
      onClick,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      button,
      href,
      children,
      className,
      disabled,
      noTheme,
      ...other
    } = this.props;
    return button ? (
      <button onClick={this._handleClick} className={className} {...other}>
        {children}
      </button>
    ) : (
      <a
        href={href}
        onClick={this._handleClick}
        className={classnames(className, {
          'theme--link': !noTheme,
        })}
        // @ts-expect-error -- TSCONVERSION
        disabled={disabled}
        {...other}
      >
        {children}
      </a>
    );
  }
}
