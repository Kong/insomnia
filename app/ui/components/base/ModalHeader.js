import React, {PropTypes} from 'react';
import classnames from 'classnames';

const ModalHeader = ({hideCloseButton, className, children}) => {
  let closeButton = null;

  if (!hideCloseButton) {
    closeButton = (
      <button type="button" className="btn btn--compact modal__close-btn" data-close-modal="true">
        <i className="fa fa-times"></i>
      </button>
    )
  }

  return (
    <div className={classnames('modal__header', className)}>
      {closeButton}
      {children}
    </div>
  );
};

ModalHeader.propTypes = {
  hideCloseButton: PropTypes.bool
};

export default ModalHeader;
