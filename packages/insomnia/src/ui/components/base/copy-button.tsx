import { clipboard } from 'electron';
import { Button, ButtonProps } from 'insomnia-components';
import React, { FC, useCallback, useState } from 'react';
import { useInterval } from 'react-use';

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
  const onClick = useCallback((event: React.MouseEvent) => {
    const fn = async () => {
      event.preventDefault();
      event.stopPropagation();
      const toCopy = typeof content === 'string' ? content : await content();

      if (toCopy) {
        clipboard.writeText(toCopy);
      }
      setshowConfirmation(true);
    };
    fn();
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
