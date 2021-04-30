import React, { ButtonHTMLAttributes, PureComponent, ReactNode } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';

interface Props {
  children: ReactNode,
  value?: any,
  className?: string,
  onDisabledClick?: Function,
  onClick?: Function,
  disabled?: boolean,
  tabIndex?: number,
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'],
  id?: string,
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class Button extends PureComponent<Props> {
  _handleClick(e) {
    const { onClick, onDisabledClick, disabled } = this.props;
    const fn = disabled ? onDisabledClick : onClick;

    if (this.props.hasOwnProperty('value')) {
      fn && fn(this.props.value, e);
    } else {
      fn && fn(e);
    }
  }

  render() {
    const { children, disabled, tabIndex, className, type, id } = this.props;
    return (
      <button
        disabled={disabled}
        id={id}
        type={type}
        tabIndex={tabIndex}
        className={className}
        onClick={this._handleClick}
      >
        {children}
      </button>
    );
  }
}

export default Button;
