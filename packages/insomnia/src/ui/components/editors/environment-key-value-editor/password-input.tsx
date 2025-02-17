import React, { useState } from 'react';

import { OneLineEditor } from '../../codemirror/one-line-editor';

export interface PasswordInputProps {
  value: string;
  label?: string;
  placeholder?: string;
  className?: string;
  enabled: boolean;
  itemId: string;
  onChange: (value: string) => void;
  onShowPassword?: (value: string) => void;
  onHidePassword?: (value: string) => void;
};

export const PasswordInput = (props: PasswordInputProps) => {
  const { value, className, placeholder, enabled, itemId, onShowPassword, onHidePassword, onChange } = props;
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
    <div className={`h-full w-full flex items-center justify-between ${className}`}>
      <div className='flex-1 w-full h-full'>
        {isHidden ?
          <input
            value={value}
            className='placeholder-[--hl-lg] w-full h-full'
            onChange={event => onChange(event.target.value)}
            placeholder={placeholder}
            readOnly={!enabled}
            type={'password'}
          /> :
          <OneLineEditor
            id={`environment-kv-editor-value-${itemId}`}
            placeholder={placeholder}
            defaultValue={value}
            readOnly={!enabled}
            onChange={newValue => onChange(newValue)}
          />
        }
      </div>
      <button
        className='m-0 px-1 h-full items-center'
        onClick={handleShowHidePassword}
      >
        {isHidden ? <i className="fa fa-eye-slash" /> : <i className="fa fa-eye" />}
      </button>
    </div>
  );
};
