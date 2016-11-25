import React, {Component} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';

class ImportSummaryModal extends Component {
  constructor (props) {
    super(props);

    this.state = {
      summary: {}
    };
  }

  show ({summary}) {
    this.modal.show();
    this.setState({summary});
  }

  render () {
    const {summary} = this.state;

    return (
      <Modal ref={m => this.modal = m}>
        <ModalHeader>Import Summary</ModalHeader>
        <ModalBody className="wide">
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

ImportSummaryModal.propTypes = {};

export default ImportSummaryModal;
