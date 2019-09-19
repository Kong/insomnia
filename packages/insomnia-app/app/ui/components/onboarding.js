// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from './base/modal';
import ModalBody from './base/modal-body';
import ModalHeader from './base/modal-header';
import * as db from '../../common/database';
import * as models from '../../models';
import type { GlobalActivity } from './activity-bar/activity-bar';
import type { BaseModel } from '../../models';

type Props = {
  handleImportFile: () => void,
  handleImportUri: (uri: string) => void,
  handleSetActivity: (activity: GlobalActivity) => void,
};

@autobind
class Onboarding extends React.PureComponent<Props> {
  setModalRef(m: ?Modal) {
    if (m) {
      m.show();
    }
  }

  componentDidMount() {
    db.onChange(this._handleDbChange);
  }

  _handleDbChange(changes: Array<[string, BaseModel, boolean]>) {
    for (const change of changes) {
      if (change[1].type === models.workspace.type) {
        setTimeout(() => {
          this._handleDone();
        }, 400);
      }
    }
  }

  _handleDone() {
    const { handleSetActivity } = this.props;
    handleSetActivity('spec');

    // Unsubscribe DB listener
    db.offChange(this._handleDbChange);
  }

  _handleImportFile() {
    const { handleImportFile } = this.props;
    handleImportFile();
  }

  _handleImportUri() {
    const { handleImportUri } = this.props;
    handleImportUri('');
  }

  render() {
    return (
      <div className="onboarding">
        <div className="tall wide theme--sidebar" />
        <Modal ref={this.setModalRef} onCancel={this._handleDone}>
          <ModalHeader>Welcome to Kong Studio</ModalHeader>
          <ModalBody className="pad">
            <h1>Import OpenAPI Spec</h1>
            <button className="btn btn--clicky space-right" onClick={this._handleImportFile}>
              From File
            </button>
            <button className="btn btn--clicky" onClick={this._handleImportUri}>
              From Uri
            </button>
          </ModalBody>
        </Modal>
      </div>
    );
  }
}

export default Onboarding;
