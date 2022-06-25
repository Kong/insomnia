import React, { ButtonHTMLAttributes, useState } from 'react';

import { Button } from './button';

const STATE_DEFAULT = 'default';
const STATE_ASK = 'ask';
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  addIcon?: boolean;
  confirmMessage?: string;
  doneMessage?: string;
}

export const PromptButton: React.FC<Props> = ({ children,
  onClick,
  addIcon,
  disabled,
  confirmMessage,
  doneMessage,
  tabIndex,
  ...rest }) => {

  const [value, setValue] = useState(STATE_DEFAULT);

  const onPrompt = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (value === STATE_DEFAULT) {
      // Prevent events (ex. won't close dropdown if it's in one)
      event.preventDefault();
      event.stopPropagation();
      // Toggle the confirmation notice
      setValue(STATE_ASK);
      return;
    }
    if (value === STATE_ASK) {
      onClick?.(event);
      setValue(STATE_DEFAULT);
    }
  };

  return <Button onClick={onPrompt} {...rest}>
    {
      value === STATE_ASK ?
        <span className="warning" title="Click again to confirm">
          {addIcon ? <i className="fa fa-exclamation-circle" /> : null}
          {confirmMessage ? <span className="space-left">{confirmMessage}</span> : 'Click to confirm'}
        </span>
        : children
    }
  </Button>;
};
