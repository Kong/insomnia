import classnames from 'classnames';
import React, { ButtonHTMLAttributes, createElement, ReactNode } from 'react';

interface Props {
  title?: string;
  buttonClass?: React.ElementType;
  stayOpenAfterClick?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick?: (event: React.MouseEvent<Element, MouseEvent>) => void;
  children: ReactNode;
  className?: string;
  color?: string;
  unsetStyles?: boolean;
  dataTestId?: string;
}

export const DropdownItem = (props: Props) => {
  const {
    buttonClass,
    children,
    className,
    color,
    onClick,
    unsetStyles,
    selected,
    disabled,
    stayOpenAfterClick,
    dataTestId,
    ...otherProps
  } = props;

  const styles = color
    ? {
      color,
    }
    : {};

  const _dataTestId = dataTestId ? dataTestId : 'DropDownItem';
  const inner = (
    <div className={classnames('dropdown__inner', className)} data-testid={_dataTestId}>
      <div className="dropdown__text" style={styles}>
        {children}
      </div>
    </div>
  );

  const buttonProps: ButtonHTMLAttributes<HTMLButtonElement> = {
    type: 'button',
    className: classnames({
      'dropdown__item-button-unset': unsetStyles,
    }),
    style: selected ? {
      background: 'var(--hl-xs)',
      fontWeight: 'bold',
    } : {},
    onClick: (event: React.MouseEvent) => {
      if (stayOpenAfterClick) {
        event.stopPropagation();
      }

      if (!onClick || disabled) {
        return;
      }

      onClick(event);
    },
    ...otherProps,
  };

  return createElement(buttonClass || 'button', buttonProps, inner);
};
