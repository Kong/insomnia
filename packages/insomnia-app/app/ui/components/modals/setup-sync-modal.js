// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import * as sync from '../../../sync';
import {
  SYNC_MODE_OFF,
  SYNC_MODE_ON,
  SYNC_MODE_NEVER,
  SYNC_MODE_UNSET
} from '../../../sync/storage';
import type { Workspace } from '../../../models/workspace';
import HelpTooltip from '../help-tooltip';

type Props = {
  workspace: Workspace
};

type State = {
  syncMode: string,
  selectedSyncMode: string,
  syncDisableCookieJars: boolean,
  syncDisableClientCertificates: boolean
};

@autobind
class SetupSyncModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  _onSelectSyncMode: ?(selectedSyncMode: string) => void;

  constructor(props: Props) {
    super(props);
    this.state = {
      syncMode: SYNC_MODE_UNSET,
      selectedSyncMode: SYNC_MODE_ON,
      syncDisableCookieJars: false,
      syncDisableClientCertificates: false
    };
  }

  _setModalRef(n: ?Modal) {
    this.modal = n;
  }

  _handleToggleSyncCertificates(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ syncDisableClientCertificates: !e.currentTarget.checked });
  }

  _handleToggleSyncCookieJars(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ syncDisableCookieJars: !e.currentTarget.checked });
  }

  async _handleDone() {
    const { workspace } = this.props;
    const { selectedSyncMode, syncDisableClientCertificates, syncDisableCookieJars } = this.state;

    const resource = await sync.getOrCreateResourceForDoc(workspace);
    await sync.createOrUpdateConfig(resource.resourceGroupId, {
      syncMode: selectedSyncMode,
      syncDisableClientCertificates: !!syncDisableClientCertificates,
      syncDisableCookieJars: !!syncDisableCookieJars
    });

    this.hide();

    this._onSelectSyncMode && this._onSelectSyncMode(selectedSyncMode);
  }

  _handleSyncModeChange(e: SyntheticEvent<HTMLSelectElement>) {
    const selectedSyncMode = e.currentTarget.value;

    this.setState({
      selectedSyncMode
    });
  }

  async show(options: { onSelectSyncMode: (syncMode: string) => void }) {
    const { workspace } = this.props;

    const resource = await sync.getOrCreateResourceForDoc(workspace);
    const config = await sync.getOrCreateConfig(resource.resourceGroupId);
    const { syncMode, syncDisableCookieJars, syncDisableClientCertificates } = config;

    // Set selected sync mode. If it's unset, default it to ON
    const selectedSyncMode = syncMode !== SYNC_MODE_UNSET ? syncMode : SYNC_MODE_ON;

    this.setState({
      syncMode,
      selectedSyncMode,
      syncDisableCookieJars,
      syncDisableClientCertificates
    });

    this._onSelectSyncMode = options.onSelectSyncMode;

    this.modal && this.modal.show();
  }

  hide() {
    this.modal && this.modal.hide();
  }

  render() {
    const { workspace } = this.props;
    const {
      syncMode,
      selectedSyncMode,
      syncDisableClientCertificates,
      syncDisableCookieJars
    } = this.state;

    return (
      <Modal ref={this._setModalRef} noEscape>
        <ModalHeader>Workspace Sync Setup</ModalHeader>
        <ModalBody className="wide pad-left pad-right">
          {syncMode === SYNC_MODE_UNSET ? (
            <p className="notice info">
              You have not yet configured sync for your <strong>{workspace.name}</strong> workspace.
            </p>
          ) : null}
          <br />
          <div className="form-control form-control--outlined">
            <label>
              Sync mode
              <HelpTooltip className="space-left">
                Control how and when data for this workspace is synced with the server
              </HelpTooltip>
              <select onChange={this._handleSyncModeChange} value={selectedSyncMode}>
                <option value={SYNC_MODE_ON}>Automatically sync changes</option>
                <option value={SYNC_MODE_OFF}>Manually sync changes</option>
                <option value={SYNC_MODE_NEVER}>Disable sync for this workspace</option>
              </select>
            </label>
          </div>
          <br />
          <label className="bold">
            Advanced Rules
            <HelpTooltip className="space-left">
              Customize sync for you or your team's needs by choosing which resources are synced for
              this workspace
            </HelpTooltip>
          </label>
          <div className="form-control form-control--thin">
            <label>
              Sync Cookie Jars
              <input
                type="checkbox"
                checked={!syncDisableCookieJars}
                onChange={this._handleToggleSyncCookieJars}
              />
            </label>
          </div>
          <div className="form-control form-control--thin">
            <label>
              Sync SSL Client Certificates
              <input
                type="checkbox"
                checked={!syncDisableClientCertificates}
                onChange={this._handleToggleSyncCertificates}
              />
            </label>
          </div>
          <br />
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

export default SetupSyncModal;
