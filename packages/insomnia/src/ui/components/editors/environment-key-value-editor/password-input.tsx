import React, { useState } from 'react';

import { OneLineEditor } from '~/ui/components/.client/codemirror/one-line-editor';

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
}

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
    <div className={`flex h-full w-full items-center justify-between ${className}`}>
      <div className="h-full w-full flex-1">
        <OneLineEditor
          id={`environment-kv-editor-value-${itemId}`}
          historyKey={`environment-kv-editor-value-${itemId}`}
          type={isHidden ? 'password' : 'text'}
          placeholder={placeholder}
          defaultValue={value}
          readOnly={!enabled}
          onChange={onChange}
        />
      </div>
      <button className="m-0 h-full items-center px-1" onClick={handleShowHidePassword}>
        {isHidden ? <i className="fa fa-eye-slash" /> : <i className="fa fa-eye" />}
      </button>
    </div>
  );
};
