import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import CodeEditor from '../codemirror/code-editor';

@autobind
class CodePromptModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      title: 'Not Set',
      defaultValue: '',
      submitName: 'Not Set',
      placeholder: '',
      hint: '',
      mode: 'text/plain'
    };
  }

  _setModalRef (n) {
    this.modal = n;
  }

  _handleChange (value) {
    this._onChange(value);
  }

  hide () {
    this.modal.hide();
  }

  show (options) {
    const {
      title,
      defaultValue,
      submitName,
      placeholder,
      hint,
      mode,
      onChange
    } = options;

    this.modal.show();

    this._onChange = onChange;

    this.setState({
      title,
      defaultValue,
      submitName,
      placeholder,
      hint,
      mode
    });
  }

  render () {
    const {
      submitName,
      title,
      placeholder,
      defaultValue,
      hint,
      mode
    } = this.state;

    return (
      <Modal ref={this._setModalRef} freshState tall>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody className="wide tall" style={{minHeight: '10rem'}}>
          <CodeEditor
            defaultValue={defaultValue}
            placeholder={placeholder}
            onChange={this._handleChange}
            mode={mode}
          />
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm tall">{hint ? `* ${hint}` : ''}</div>
          <button className="btn" onClick={this.hide}>
            {submitName || 'Submit'}
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

CodePromptModal.propTypes = {};

export default CodePromptModal;
