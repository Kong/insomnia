import React, { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, ...rest }) => {
  return <button {...rest}>{children}</button>;
};
