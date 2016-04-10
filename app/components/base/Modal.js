import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';

const ModalHeader = (props) => (
  <div className="modal__header bg-light">
    <div className="grid">
      <div className="grid__cell pad">
        <div className={props.className}>
          {props.children}
        </div>
      </div>
      <div className="grid--v">
        <button className="btn btn--compact txt-lg" data-close-modal="true">
          <i className="fa fa-times"></i>
        </button>
      </div>
    </div>
  </div>
);

const ModalBody = (props) => (
  <div className={classnames('modal__body', 'grid__cell', 'scrollable', props.className)}>
    {props.children}
  </div>
);

const ModalFooter = (props) => (
  <div className="modal__footer">
    <div className={props.className}>
      {props.children}
    </div>
  </div>
);

class Modal extends Component {
  _handleClick (e) {
    // Did we click a close button. Let's check a few parent nodes up as well
    // because some buttons might have nested elements. Maybe there is a better
    // way to check this?
    let target = e.target;
    let close = false;

    if (target === this.refs.modal) {
      close = true;
    }

    for (let i = 0; i < 5; i++) {
      if (target.hasAttribute('data-close-modal')) {
        close = true;
        break;
      }

      target = target.parentNode;
    }

    if (close) {
      this.close();
    }
  }

  _keyDown (e) {
    if (e.keyCode === 27) {
      // We pressed ESC
      this.close();
    }
  }

  close () {
    this.props.onClose && this.props.onClose();
  }

  componentDidMount () {
    this.refs.modal.focus();
  }

  render () {
    return (
      <div ref="modal"
           tabIndex="-1"
           className={classnames('modal', 'grid', 'grid--center', this.props.className)}
           onKeyDown={this._keyDown.bind(this)}
           onClick={this._handleClick.bind(this)}>
        <div className={classnames('modal__content', 'grid--v', 'bg-super-light', {tall: this.props.tall})}>
          {this.props.children}
        </div>
      </div>
    )
  }
}

Modal.propTypes = {
  onClose: PropTypes.func,
  tall: PropTypes.bool
};

export {Modal, ModalHeader, ModalBody, ModalFooter};
