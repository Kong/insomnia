import React, { ButtonHTMLAttributes, CSSProperties, PropsWithChildren } from 'react';
export interface ButtonProps<T> {
  value?: T;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>, value?: T) => void;
  disabled?: boolean;
  tabIndex?: number;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  id?: string;
  title?: string;
  style?: CSSProperties;
}

export const Button = <T, >({
  value,
  disabled,
  tabIndex,
  className,
  type,
  id,
  style,
  title,
  onClick,
  children,
}: PropsWithChildren<ButtonProps<T>>) => {
  /**
   * This function fires when user clicks the button
   * @param e The mouse click event
   */
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => onClick?.(e, value);

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
