// @flow
import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

type Props = {};

@autobind
class ExportRequestsModal extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  _setModalRef(n: React.Component<*> | null) {
    this.modal = n;
  }

  show() {
    this.modal.show();
  }

  hide() {
    this.modal.hide();
  }

  handleExport() {}

  render() {
    return (
      <Modal ref={this._setModalRef} tall freshState {...this.props}>
        <ModalHeader>Export Requests</ModalHeader>
        <ModalBody />
        <ModalFooter>
          <div>
            <button className="btn" onClick={this.hide}>
              Cancel
            </button>
            <button className="btn" onClick={this.handleExport}>
              Export
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default ExportRequestsModal;
