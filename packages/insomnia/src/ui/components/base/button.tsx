import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { ButtonHTMLAttributes, CSSProperties, PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';

export interface ButtonProps<T> {
  children: ReactNode;
  value?: T;
  className?: string;
  onDisabledClick?: (event: React.MouseEvent<HTMLButtonElement>, value?: T) => void;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>, value?: T) => void;
  disabled?: boolean;
  tabIndex?: number;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  id?: string;
  title?: string;
  style?: CSSProperties;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Button<T> extends PureComponent<ButtonProps<T>> {
  _handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    const { onClick, onDisabledClick, disabled, value } = this.props;
    const fn = disabled ? onDisabledClick : onClick;

    if (this.props.hasOwnProperty('value')) {
      fn?.(event, value);
    } else {
      fn?.(event);
    }
  }

  render() {
    const { children, disabled, tabIndex, className, type, id, style, title } = this.props;
    return (
      <button
        disabled={disabled}
        id={id}
        type={type}
        tabIndex={tabIndex}
        className={className}
        onClick={this._handleClick}
        style={style}
        title={title}
      >
        {children}
      </button>
    );
  }
}
