import React, {Component} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';

class PromptModal extends Component {
  constructor (props) {
    super(props);

    this.state = {
      headerName: 'Not Set',
      defaultValue: '',
      submitName: 'Not Set',
      selectText: false,
      hint: null
    };
  }

  _onSubmit (e) {
    e.preventDefault();

    this._onSubmitCallback && this._onSubmitCallback(this._input.value);
    this.modal.hide();
  }

  _setDefaultValueFromState () {
    if (this.state.defaultValue) {
      this._input.value = this.state.defaultValue;
    }

    // Need to do this after render because modal focuses itself too
    setTimeout(() => {
      this._input.focus();
      if (this.state.selectText) {
        this._input.select();
      }
    }, 100);
  }

  show ({headerName, defaultValue, submitName, selectText, hint}) {
    this.modal.show();

    return new Promise(resolve => {
      this._onSubmitCallback = resolve;

      this.setState({
        headerName,
        defaultValue,
        submitName,
        selectText,
        hint
      })
    });
  }

  componentDidUpdate () {
    this._setDefaultValueFromState();
  }

  render () {
    const {extraProps} = this.props;
    const {submitName, headerName, hint} = this.state;

    return (
      <Modal ref={m => this.modal = m} {...extraProps}>
        <ModalHeader>{headerName}</ModalHeader>
        <ModalBody className="wide">
          <form onSubmit={e => this._onSubmit(e)} className="wide pad">
            <div className="form-control form-control--outlined form-control--wide">
              <input ref={n => this._input = n} type="text"/>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm tall">{hint ? `* ${hint}` : ''}</div>
          <div>
            <button className="btn" onClick={() => this.modal.hide()}>
              Cancel
            </button>
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
