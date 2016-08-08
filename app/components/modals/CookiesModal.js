import React, {PropTypes, Component} from 'react';

import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';

class CookiesModal extends Component {
  _saveChanges () {

  }

  show () {
    this.modal.show();
  }

  toggle () {
    this.modal.toggle();
  }

  render () {
    return (
      <Modal ref={m => this.modal = m} top={true} tall={true} {...this.props}>
        <ModalHeader>
          Cookies <span className="faint txt-sm">– manage cookies for domains</span>
        </ModalHeader>
        <ModalBody>
          <div className="pad no-pad-bottom">
            Some good cookie
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={this._saveChanges.bind(this)}>
              Save
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

CookiesModal.propTypes = {
  onChange: PropTypes.func.isRequired
};

// export CookiesModal;
export default CookiesModal;
