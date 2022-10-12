import { clipboard } from 'electron';
import React, { FC, useCallback, useState } from 'react';
import { useInterval } from 'react-use';

import { Button, ButtonProps } from '../themed-button';

interface Props extends ButtonProps {
  confirmMessage?: string;
  content: string | Function;
  title?: string;
}

export const CopyButton: FC<Props> = ({
  children,
  confirmMessage,
  content,
  title,
  ...buttonProps
}) => {
  const [showConfirmation, setshowConfirmation] = useState(false);
  const onClick = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const toCopy = typeof content === 'string' ? content : await content();

    if (toCopy) {
      clipboard.writeText(toCopy);
    }
    setshowConfirmation(true);
  }, [content]);

  useInterval(() => {
    setshowConfirmation(false);
  }, 2000);

  const confirm = typeof confirmMessage === 'string' ? confirmMessage : 'Copied';
  return (
    <Button
      {...buttonProps}
      title={title}
      onClick={onClick}
    >
      {showConfirmation ? (
        <span>
          {confirm} <i className="fa fa-check-circle-o" />
        </span>
      ) : (
        children || 'Copy to Clipboard'
      )}
    </Button>
  );
};
