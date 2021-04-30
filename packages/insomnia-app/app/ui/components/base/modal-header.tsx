import React, { PureComponent, ReactNode } from 'react';
import classnames from 'classnames';

interface Props {
  children: ReactNode;
  hideCloseButton?: boolean;
  className?: string;
}

class ModalHeader extends PureComponent<Props> {
  render() {
    const { hideCloseButton, className, children } = this.props;
    let closeButton: null | JSX.Element = null;

    if (!hideCloseButton) {
      closeButton = (
        <button type="button" className="btn btn--compact modal__close-btn" data-close-modal="true">
          <i className="fa fa-times" />
        </button>
      );
    }

    return (
      <div className={classnames('modal__header theme--dialog__header', className)}>
        <div className="modal__header__children">{children}</div>
        {closeButton}
      </div>
    );
  }
}

export default ModalHeader;
