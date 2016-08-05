import React, {PropTypes} from 'react';

import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import ModalComponent from '../lib/ModalComponent';


class CookieEditModal extends ModalComponent {
  _saveChanges () {

  }

  render () {
    return (
      <Modal ref="modal" top={true} tall={true} {...this.props}>
        <ModalHeader>
          Cookies <span className="faint txt-sm">– manage cookies for domains</span>
        </ModalHeader>
        <ModalBody>
          <div className="pad no-pad-bottom">
            Some good cookies
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={this._saveChanges.bind(this)}>Save</button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

CookieEditModal.propTypes = {
  onChange: PropTypes.func.isRequired
};

export default CookieEditModal;
