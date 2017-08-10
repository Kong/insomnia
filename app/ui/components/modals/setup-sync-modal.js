import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import * as sync from '../../../sync';
import {SYNC_MODE_OFF, SYNC_MODE_ON, SYNC_MODE_NEVER, SYNC_MODE_UNSET} from '../../../sync/storage';

@autobind
class SetupSyncModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      syncMode: SYNC_MODE_UNSET,
      selectedSyncMode: SYNC_MODE_ON
    };
  }

  _setModalRef (n) {
    this.modal = n;
  }

  async _handleDone () {
    const {workspace} = this.props;
    const {selectedSyncMode} = this.state;

    const resource = await sync.getOrCreateResourceForDoc(workspace);
    await sync.createOrUpdateConfig(resource.resourceGroupId, selectedSyncMode);

    this.hide();

    this._resolvePromise && this._resolvePromise(selectedSyncMode);
  }

  _handleSyncModeChange (e) {
    this.setState({selectedSyncMode: e.target.value});
  }

  show () {
    (async () => {
      const {workspace} = this.props;

      const resource = await sync.getOrCreateResourceForDoc(workspace);
      const config = await sync.getOrCreateConfig(resource.resourceGroupId);
      const {syncMode} = config;

      // Set selected sync mode. If it's unset, default it to ON
      const selectedSyncMode = syncMode !== SYNC_MODE_UNSET ? syncMode : SYNC_MODE_ON;

      this.setState({
        syncMode,
        selectedSyncMode
      });
    })();

    this.modal.show();

    this._promise = new Promise(resolve => {
      this._resolvePromise = resolve;
    });

    return this._promise;
  }

  hide () {
    this.modal.hide();
  }

  render () {
    const {workspace} = this.props;
    const {syncMode, selectedSyncMode} = this.state;

    return (
      <Modal ref={this._setModalRef} noEscape>
        <ModalHeader>Workspace Sync Setup</ModalHeader>
        <ModalBody className="wide pad">
          {syncMode === SYNC_MODE_UNSET
            ? <p className="notice info">
              You have not yet configured sync for your <strong>{workspace.name}</strong> workspace.
            </p> : null
          }
          <br/>
          <div className="form-control form-control--outlined">
            <label>Choose sync mode
              <select onChange={this._handleSyncModeChange} value={selectedSyncMode}>
                <option value={SYNC_MODE_ON}>
                  Automatically sync changes
                </option>
                <option value={SYNC_MODE_OFF}>
                  Manually sync changes
                </option>
                <option value={SYNC_MODE_NEVER}>
                  Disable sync for this workspace
                </option>
              </select>
            </label>
          </div>
          <br/>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm tall">
            * This can be changed at any time
          </div>
          <button className="btn" onClick={this._handleDone}>
            Continue
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

SetupSyncModal.propTypes = {
  workspace: PropTypes.object.isRequired
};

export default SetupSyncModal;
