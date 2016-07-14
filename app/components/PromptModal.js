import React from 'react'
import Modal from './base/Modal'
import ModalBody from './base/ModalBody'
import ModalHeader from './base/ModalHeader'
import ModalFooter from './base/ModalFooter'
import ModalComponent from './lib/ModalComponent'

class PromptModal extends ModalComponent {
  constructor (props) {
    super(props);

    this.state = {
      headerName: 'Not Set',
      defaultValue: '',
      submitName: 'Not Set',
      selectText: false
    };
  }

  _onSubmit (e) {
    e.preventDefault();

    this._onSubmitCallback && this._onSubmitCallback(this.refs.input.value);
    this.hide();
  }

  _setDefaultValueFromState () {
    if (this.state.defaultValue) {
      this.refs.input.value = this.state.defaultValue;
    }

    this.refs.input.focus();
    if (this.state.selectText) {
      this.refs.input.select();
    }
  }

  show ({headerName, defaultValue, submitName, selectText}) {
    super.show();

    return new Promise(resolve => {
      this._onSubmitCallback = resolve;

      this.setState({
        headerName,
        defaultValue,
        submitName,
        selectText
      })
    });
  }

  componentDidUpdate () {
    this._setDefaultValueFromState();
  }

  render () {
    const {extraProps} = this.props;
    const {submitName, headerName} = this.state;

    return (
      <Modal ref="modal" {...extraProps}>
        <ModalHeader>{headerName}</ModalHeader>
        <ModalBody className="wide">
          <form onSubmit={e => this._onSubmit(e)} className="wide pad">
            <div className="form-control form-control--outlined form-control--wide">
              <input ref="input" type="text"/>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={() => this.hide()}>Cancel</button>
            <button className="btn" onClick={this._onSubmit.bind(this)}>
              {submitName || 'Save'}
            </button>
          </div>
        </ModalFooter>
      </Modal>
    )
  }
}

PromptModal.propTypes = {};

export default PromptModal;
