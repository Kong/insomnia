import classnames from 'classnames';
import React, { FC, HTMLAttributes, memo, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  noScroll?: boolean;
  className?: string;
  children?: ReactNode;
}

export const ModalBody: FC<Props> = memo(({ className, children, noScroll, ...props }) => {
  const classes = classnames(className, 'modal__body theme--dialog__body', {
    'modal__body--no-scroll': noScroll,
  });
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
});

ModalBody.displayName = 'ModalBody';
