import React, {Component, PropTypes} from 'react'
import Modal from './Modal'
import ModalBody from './ModalBody'
import ModalHeader from './ModalHeader'
import ModalFooter from './ModalFooter'

class PromptModal extends Component {
  _onSubmit (e) {
    e.preventDefault();

    this.props.onSubmit(this.refs.input.value);
    this.refs.modal.close();
  }

  _setDefaultValueFromProps () {
    if (this.props.defaultValue) {
      this.refs.input.value = this.props.defaultValue;
    }

    this.refs.input.focus();
    if (this.props.selectText) {
      this.refs.input.select();
    }
  }

  componentDidMount () {
    this._setDefaultValueFromProps();
  }

  componentDidUpdate () {
    this._setDefaultValueFromProps();
  }

  render () {
    const {onClose, submitName, headerName, ...extraProps} = this.props;
    return (
      <Modal ref="modal" onClose={onClose} {...extraProps}>
        <ModalHeader>{headerName}</ModalHeader>
        <ModalBody className="wide">
          <form onSubmit={this._onSubmit.bind(this)} className="wide pad">
            <div className="form-control form-control--outlined form-control--wide">
              <input ref="input" type="text"/>
            </div>
          </form>
        </ModalBody>
        <ModalFooter className="grid grid--end">
          <button className="btn" onClick={() => this.refs.modal.close()}>Cancel</button>
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
  headerName: PropTypes.string.isRequired,
  defaultValue: PropTypes.string,
  submitName: PropTypes.string,
  selectText: PropTypes.bool,
  onClose: PropTypes.func
};

export default PromptModal;
