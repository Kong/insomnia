import React, {Component, PropTypes} from 'react';
import {Modal, ModalHeader, ModalBody, ModalFooter} from './Modal'

class PromptModal extends Component {
  _onSubmit (e) {
    e.preventDefault();

    this.props.onSubmit(this.refs.input.value);
    this.refs.modal.close();
  }

  render () {
    const {visible, onClose, submitName, headerName} = this.props;

    return (
      <Modal ref="modal" onClose={onClose} visible={visible}>
        <ModalHeader>{headerName}</ModalHeader>
        <ModalBody>
          <form onSubmit={this._onSubmit.bind(this)}>
            <input ref="input"
                   type="text"
                   autoFocus={true}
                   className="form-control form-control--outlined"/>
          </form>
        </ModalBody>
        <ModalFooter className="grid grid--end">
          <button className="btn" onClick={this._onSubmit.bind(this)}>
            {submitName || 'Save'}
          </button>
        </ModalFooter>
      </Modal>
    )
  }
}

PromptModal.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  visible: PropTypes.bool.isRequired,
  headerName: PropTypes.string.isRequired,
  submitName: PropTypes.string,
  onClose: PropTypes.func
};

export default PromptModal;
