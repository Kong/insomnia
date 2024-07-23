import classnames from 'classnames';
import React, { type FC, memo, type ReactNode } from 'react';

interface Props {
  className?: string;
  children: ReactNode;
}

export const ModalFooter: FC<Props> = memo(({ children, className }) => (
  <div className={classnames('modal__footer theme--dialog__footer', className)}>
    {children}
  </div>
));

ModalFooter.displayName = 'ModalFooter';
