import { clipboard } from 'electron';
import { Button, ButtonProps } from 'insomnia-components';
import React, { ReactNode, useEffect, useState } from 'react';

interface Props extends ButtonProps {
  children?: ReactNode;
  confirmMessage?: string;
  content: string | Function;
  title?: string;
}

export const CopyButton: React.FC<Props> = ({
  children,
  confirmMessage,
  content,
  title,
  ...other
}) => {
  const [showConfirmation, setshowConfirmation] = useState(false);
  const onClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const toCopy = typeof content === 'string' ? content : await content();

    if (toCopy) {
      clipboard.writeText(toCopy);
    }
    setshowConfirmation(true);

  };
  useEffect(() => {
    const timer = setTimeout(() => {
      setshowConfirmation(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [showConfirmation]);

  const confirm = typeof confirmMessage === 'string' ? confirmMessage : 'Copied';
  return (
    <Button
      {...other}
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
