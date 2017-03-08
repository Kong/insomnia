import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import OneLineEditor from '../codemirror/one-line-editor';
import {trackEvent} from '../../../analytics';

@autobind
class NunjucksVariableModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      template: '',
      value: '',
      error: '',
      key: 0
    };
    this._timeout = null;
  }

  _setModalRef (n) {
    this.modal = n;
  }

  async _debouncedUpdate (...args) {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      this._update(...args)
    }, 500);
  }

  async _update (template, newKey = false) {
    const {handleRender} = this.props;

    let value = '';
    let error = '';

    try {
      value = await handleRender(template, true);
    } catch (err) {
      error = err.message;
    }

    this.setState({
      template,
      value,
      error,
      key: newKey ? this.state.key + 1 : this.state.key
    });
  }

  async show ({template}) {
    this.modal.show();
    await this._update(template, true);
  }

  hide () {
    trackEvent('Billing', 'Trial Ended', 'Cancel');
    this.modal.hide();
  }

  render () {
    const {template, value, error, key} = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Edit Variable</ModalHeader>
        <ModalBody className="pad" key={key}>
          <div className="form-control form-control--outlined">
            <label>Variable
              <OneLineEditor
                forceEditor
                onChange={this._debouncedUpdate}
                defaultValue={template}
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>Result
              {error
                ? <code className="block danger">{error}</code>
                : <code className="block">{value}</code>
              }
            </label>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

NunjucksVariableModal.propTypes = {
  handleRender: PropTypes.func.isRequired
};

export default NunjucksVariableModal;
