import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { useInterval } from 'react-use';

import { Button, type ButtonProps } from '../themed-button';

export interface CopyBtnHanlde {
  copy: () => void;
}
interface Props extends ButtonProps {
  confirmMessage?: string;
  content: string;
  title?: string;
}

export const CopyButton = forwardRef<CopyBtnHanlde, Props>((props, ref) => {
  const {
    children,
    confirmMessage,
    content,
    title,
    ...buttonProps
  } = props;
  const [showConfirmation, setshowConfirmation] = useState(false);
  const onClick = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (content) {
      window.clipboard.writeText(content);
    }
    setshowConfirmation(true);
  }, [content]);

  useInterval(() => {
    setshowConfirmation(false);
  }, 2000);

  useImperativeHandle(ref, () => ({
    copy: () => {
      if (content) {
        window.clipboard.writeText(content);
        setshowConfirmation(true);
      }
    },
  }), [content]);

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
});
