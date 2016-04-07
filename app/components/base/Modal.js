import React, {Component, PropTypes} from 'react';

const ModalHeader = (props) => (
  <div className="modal__header">
    <div className="grid">
      <div className="grid__cell pad">
        {props.children}
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
  <div className="modal__body pad grid__cell scrollable">
    <div>
      {props.children}
    </div>
  </div>
);

const ModalFooter = (props) => (
  <div className="modal__footer pad">
    {props.children}
  </div>
);

class Modal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      visible: props.visible
    }
  }

  _handleClick (e) {
    // Did we click a close button. Let's check a few parent nodes up as well
    // because some buttons might have nested elements. Maybe there is a better
    // way to check this?

    let target = e.target;
    for (let i = 0; i < 5; i++) {
      if (target.hasAttribute('data-close-modal')) {
        this.setState({visible: !this.state.visible});
        break;
      }

      target = target.parentNode;
    }
  }

  render () {
    if (!this.state.visible) {
      return null;
    }

    return (
      <div className="modal grid grid--center"
           onClick={this._handleClick.bind(this)} ref="modal"
           data-close-modal="true">
        <div className="modal__content grid--v bg-super-light">
          {this.props.children}
        </div>
      </div>
    )
  }
}

Modal.propTypes = {
  visible: PropTypes.bool.isRequired
};

export {Modal, ModalHeader, ModalBody, ModalFooter};
