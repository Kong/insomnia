import React, { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
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

export const Button = <T, >(props: ButtonProps<T>) => {
  // Distract all the available properties.
  const {
    value,
    children,
    disabled,
    tabIndex,
    className,
    type,
    id,
    style,
    title,
    onClick,
    onDisabledClick
  } = props;

  /**
   * This function fires when user clicks the button
   * @param e The mouse click event
   */
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const fn = disabled ? onDisabledClick : onClick;

    if (props.hasOwnProperty('value')) {
      fn?.(e, value);
    } else {
      fn?.(e);
    }
  };

  return (
    <button
      disabled={disabled}
      id={id}
      type={type}
      tabIndex={tabIndex}
      className={className}
      onClick={handleClick}
      style={style}
      title={title}
    >
      {children}
    </button>
  );
};
