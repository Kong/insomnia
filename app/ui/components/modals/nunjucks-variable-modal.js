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
      value: ''
    };
  }

  _setModalRef (n) {
    this.modal = n;
  }

  async show ({template}) {
    const {handleRender} = this.props;
    const value = await handleRender(template);
    this.setState({
      template,
      value
    });

    this.modal.show();
  }

  hide () {
    trackEvent('Billing', 'Trial Ended', 'Cancel');
    this.modal.hide();
  }

  render () {
    const {template, value} = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Edit Variable</ModalHeader>
        <ModalBody className="pad">
          <div className="form-control form-control--outlined">
            <label>
              Variable Name
              <input
                type="text"
                placeholder="{{ my_var }}"
                defaultValue={template}
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>Result
              <input type="text" disabled value={value}/>
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
