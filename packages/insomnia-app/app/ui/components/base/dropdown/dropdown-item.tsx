import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { createElement, PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';

interface Props {
  addIcon?: boolean; // TODO(TSCONVERSION) some consumers are passing this prop but it appears to be unused
  title?: string;
  buttonClass?: React.ComponentType;
  stayOpenAfterClick?: boolean;
  value?: any;
  disabled?: boolean;
  onClick: Function;
  children: ReactNode;
  className?: string;
  color?: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class DropdownItem extends PureComponent<Props> {
  _handleClick(e) {
    const { stayOpenAfterClick, onClick, disabled } = this.props;

    if (stayOpenAfterClick) {
      e.stopPropagation();
    }

    if (!onClick || disabled) {
      return;
    }

    if (this.props.hasOwnProperty('value')) {
      onClick(this.props.value, e);
    } else {
      onClick(e);
    }
  }

  render() {
    const {
      buttonClass,
      children,
      className,
      color,
      onClick,
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
    const buttonProps = {
      type: 'button',
      onClick: this._handleClick,
      ...props,
    };
    // @ts-expect-error -- TSCONVERSION
    return createElement(buttonClass || 'button', buttonProps, inner);
  }
}
