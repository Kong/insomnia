import React, { type FC, useCallback, useState } from 'react';
import * as reactUse from 'react-use';

import { Button, type ButtonProps } from '../themed-button';

interface Props extends ButtonProps {
  confirmMessage?: string;
  showConfirmation?: boolean;
  content: string;
  title?: string;
}

export const CopyButton: FC<Props> = ({
  children,
  confirmMessage,
  showConfirmation: showConfirmationProp = false,
  content,
  onClick: onClickProp,
  title,
  ...buttonProps
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const onClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (content) {
        window.clipboard.writeText(content);
      }
      if (onClickProp) {
        onClickProp(event);
      }
      setShowConfirmation(true);
    },
    [content, onClickProp],
  );

  reactUse.useInterval(() => {
    setShowConfirmation(false);
  }, 2000);

  const confirm = typeof confirmMessage === 'string' ? confirmMessage : 'Copied';
  return (
    <Button {...buttonProps} title={title} onClick={onClick}>
      {showConfirmation || showConfirmationProp ? (
        <span>
          {confirm} <i className="fa fa-check-circle-o" />
        </span>
      ) : (
        children || 'Copy to Clipboard'
      )}
    </Button>
  );
};
