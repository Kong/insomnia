import classnames from 'classnames';
import React, { createElement, ReactNode } from 'react';

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
}

export const DropdownItem: React.FC<Props> = ({
  buttonClass,
  children,
  className,
  color,
  onClick,
  stayOpenAfterClick,
  disabled,
  ...props
}) => {

  const handleClick = (event: React.MouseEvent) => {
    if (stayOpenAfterClick) {
      event.stopPropagation();
    }

    if (!onClick || disabled) {
      return;
    }
    onClick(event);
  };
  const buttonProps = {
    type: 'button',
    onClick: handleClick,
    ...props,
  };
  return createElement(buttonClass || 'button', buttonProps,
    <div className={classnames('dropdown__inner', className)}>
      <div className="dropdown__text" style={color ? { color } : {}}>
        {children}
      </div>
    </div>);
};
