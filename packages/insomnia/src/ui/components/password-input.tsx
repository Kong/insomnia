import React, { useState } from 'react';

export interface PasswordInputProps {
  value: string;
  label?: string;
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
  onShowPassword?: (value: string) => void;
  onHidePassword?: (value: string) => void;
};

export const PasswordInput = (props: PasswordInputProps) => {
  const { value, className, placeholder, onShowPassword, onHidePassword, onChange } = props;
  const [isHidden, setHidden] = useState(true);

  const handleShowHidePassword = () => {
    if (isHidden && onShowPassword) {
      onShowPassword(value);
    } else if (!isHidden && onHidePassword) {
      onHidePassword(value);
    }
    setHidden(prevState => !prevState);
  };

  return (
    <div className={className}>
      <div className='relative'>
        <input
          value={value}
          className='placeholder-[--hl-lg]'
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          type={isHidden ? 'password' : 'text'}
        />
        <button
          className='absolute right-0 top-1 h-f flex m-0 px-[--padding-sm]'
          onClick={handleShowHidePassword}
        >
          {isHidden ? <i className="fa fa-eye-slash" /> : <i className="fa fa-eye" />}
        </button>
      </div>
    </div>
  );
};
