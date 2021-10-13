import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { ButtonHTMLAttributes, CSSProperties, PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';

export interface ButtonProps<T> {
  children: ReactNode;
  value?: T;
  className?: string;
  onDisabledClick?: React.MouseEventHandler<HTMLButtonElement> | ((value: T | undefined, e: React.MouseEvent<HTMLButtonElement>) => void);
  onClick?: React.MouseEventHandler<HTMLButtonElement> | ((value: T | undefined, e: React.MouseEvent<HTMLButtonElement>) => void);
  disabled?: boolean;
  tabIndex?: number;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  id?: string;
  // TODO(TSCONVERSION) figure out why so many components pass this yet it isn't used
  title?: string;
  style?: CSSProperties;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Button<T> extends PureComponent<ButtonProps<T>> {
  _handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const { onClick, onDisabledClick, disabled, value } = this.props;
    const fn = disabled ? onDisabledClick : onClick;

    if (this.props.hasOwnProperty('value')) {
      // @ts-expect-error -- TSCONVERSION we really need to make the `value` argument come second
      fn?.(value, e);
    } else {
      // @ts-expect-error -- TSCONVERSION we really need to make the `value` argument come second
      fn?.(e);
    }
  }

  render() {
    const { children, disabled, tabIndex, className, type, id, style } = this.props;
    return (
      <button
        disabled={disabled}
        id={id}
        type={type}
        tabIndex={tabIndex}
        className={className}
        onClick={this._handleClick}
        style={style}
      >
        {children}
      </button>
    );
  }
}
