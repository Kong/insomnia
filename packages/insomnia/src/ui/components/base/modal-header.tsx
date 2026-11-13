import classnames from 'classnames';
import React, { type FC, memo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  hideCloseButton?: boolean;
  className?: string;
  testId?: string;
}

export const ModalHeader: FC<Props> = memo(({ hideCloseButton, className, testId, children }) => {
  let closeButton: null | JSX.Element = null;

  if (!hideCloseButton) {
    closeButton = (
      <button
        aria-label="Modal Close Button"
        type="button"
        className="btn btn--compact modal__close-btn"
        data-close-modal="true"
      >
        <i className="fa fa-times" />
      </button>
    );
  }

  return (
    <div className={classnames('modal__header theme--dialog__header', className)}>
      <div className="modal__header__children" data-testid={testId}>
        {children}
      </div>
      {closeButton}
    </div>
  );
});

ModalHeader.displayName = 'ModalHeader';
