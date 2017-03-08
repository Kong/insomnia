import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import {trackEvent} from '../../../analytics';

@autobind
class NunjucksVariableModal extends PureComponent {
  _setModalRef (n) {
    this.modal = n;
  }

  show () {
    this.modal.show();
  }

  hide () {
    trackEvent('Billing', 'Trial Ended', 'Cancel');
    this.modal.hide();
  }

  render () {
    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Edit Variable</ModalHeader>
        <ModalBody className="pad">
          <div className="form-control">
            <input type="text"/>
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
