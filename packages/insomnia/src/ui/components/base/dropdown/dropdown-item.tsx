import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { ButtonHTMLAttributes, createElement, PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';

interface Props {
  addIcon?: boolean; // TODO(TSCONVERSION) some consumers are passing this prop but it appears to be unused
  title?: string;
  buttonClass?: React.ElementType;
  stayOpenAfterClick?: boolean;
  value?: any;
  disabled?: boolean;
  onClick: Function;
  children: ReactNode;
  className?: string;
  color?: string;
  unsetStyles?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class DropdownItem extends PureComponent<Props> {
  _handleClick(event: React.MouseEvent) {
    const { stayOpenAfterClick, onClick, disabled } = this.props;

    if (stayOpenAfterClick) {
      event.stopPropagation();
    }

    if (!onClick || disabled) {
      return;
    }

    if (this.props.hasOwnProperty('value')) {
      onClick(this.props.value, event);
    } else {
      onClick(event);
    }
  }

  render() {
    const {
      buttonClass,
      children,
      className,
      color,
      onClick,
      unsetStyles,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      stayOpenAfterClick,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      ...props
    } = this.props;
    const styles = color
      ? {
        color,
      }
      : {};
    const inner = (
      <div className={classnames('dropdown__inner', className)}>
        <div className="dropdown__text" style={styles}>
          {children}
        </div>
      </div>
    );
    const buttonProps: ButtonHTMLAttributes<HTMLButtonElement> = {
      type: 'button',
      onClick: this._handleClick,
      ...props,
    };

    if (unsetStyles) {
      buttonProps.className = 'dropdown__item-button-unset';
    }

    return createElement(buttonClass || 'button', buttonProps, inner);
  }
}
