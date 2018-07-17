import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

class ModalHeader extends PureComponent {
  render() {
    const { hideCloseButton, className, children } = this.props;
    let closeButton = null;

    if (!hideCloseButton) {
      closeButton = (
        <button
          type="button"
          className="btn btn--compact modal__close-btn"
          data-close-modal="true">
          <i className="fa fa-times" />
        </button>
      );
    }

    return (
      <div
        className={classnames(
          'modal__header theme--dialog__header',
          className
        )}>
        <div className="modal__header__children">{children}</div>
        {closeButton}
      </div>
    );
  }
}

ModalHeader.propTypes = {
  // Required
  children: PropTypes.node.isRequired,

  // Optional
  hideCloseButton: PropTypes.bool,
  className: PropTypes.string
};

export default ModalHeader;
