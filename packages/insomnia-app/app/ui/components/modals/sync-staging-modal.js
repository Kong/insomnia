// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { Workspace } from '../../../models/workspace';
import * as db from '../../../common/database';
import * as models from '../../../models';
import { session } from 'insomnia-account';
import VCS from '../../../sync/vcs';
import type { StageEntry, Status, StatusCandidate } from '../../../sync/types';

type Props = {
  workspace: Workspace,
  vcs: VCS,
};

type State = {
  status: Status,
  message: string,
  error: string,
  ahead: number,
  behind: number,
  loadingPush: boolean,
};

const WHITE_LIST = {
  [models.workspace.type]: true,
  [models.request.type]: true,
  [models.requestGroup.type]: true,
  [models.environment.type]: true,
};

@autobind
class SyncStagingModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  onPush: () => any;

  constructor(props: Props) {
    super(props);
    this.state = {
      status: {
        stage: {},
        unstaged: {},
        key: '',
      },
      error: '',
      message: '',
      ahead: 0,
      behind: 0,
      loadingPush: false,
    };
  }

  _setModalRef(m: ?Modal) {
    this.modal = m;
  }

  _handleClearError() {
    this.setState({ error: '' });
  }

  _handleMessageChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ message: e.currentTarget.value });
  }

  async _handleStage(e: SyntheticEvent<HTMLInputElement>) {
    const { vcs } = this.props;
    const id = e.currentTarget.name;
    const statusItem = this.state.status.unstaged[id];
    await vcs.stage([statusItem]);
    await this.updateStatus();
  }

  async _handleStageAll() {
    const { vcs } = this.props;
    const { unstaged } = this.state.status;

    const items = [];
    for (const id of Object.keys(unstaged)) {
      items.push(unstaged[id]);
    }

    await vcs.stage(items);
    await this.updateStatus();
  }

  async _handleUnstageAll() {
    const { vcs } = this.props;
    const { stage } = this.state.status;
    const items: Array<StageEntry> = [];
    for (const id of Object.keys(stage)) {
      items.push(stage[id]);
    }

    await vcs.unstage(items);
    await this.updateStatus();
  }

  async _handleUnstage(e: SyntheticEvent<HTMLInputElement>) {
    const { vcs } = this.props;
    const id = e.currentTarget.name;
    const statusItem = this.state.status.stage[id];
    await vcs.unstage([statusItem]);
    await this.updateStatus();
  }

  async _handleTakeSnapshot() {
    const { vcs } = this.props;
    const { message } = this.state;
    try {
      await vcs.takeSnapshot(message);
    } catch (err) {
      this.setState({ error: err.message });
      return;
    }

    await this.updateStatus({ message: '', error: '' });

    if (this.onPush) {
      this.onPush();
    }
  }

  async _handlePush() {
    this.setState({ loadingPush: true });
    const { vcs } = this.props;
    try {
      await vcs.push();
    } catch (err) {
      this.setState({ error: err.message });
    }

    await this.updateStatus({ loadingPush: false });

    // Close the modal after pushing
    this.hide();
  }

  async generateStatusItems(): Promise<Array<StatusCandidate>> {
    const items = [];
    const allDocs = await db.withDescendants(this.props.workspace);
    const docs = allDocs.filter(d => WHITE_LIST[d.type] && !(d: any).isPrivate);

    for (const doc of docs) {
      items.push({
        key: doc._id,
        name: (doc: any).name || 'No Name',
        document: doc,
      });
    }

    return items;
  }

  async updateStatus(newState?: Object) {
    const { vcs } = this.props;
    const items = await this.generateStatusItems();
    const status = await vcs.status(items);
    const branch = await vcs.getBranch();
    const branches = await vcs.getBranches();
    const { ahead, behind } = await vcs.compareRemoteBranch();

    this.setState({
      status,
      branch,
      branches,
      ahead,
      behind,
      error: '',
      ...newState,
    });
  }

  hide() {
    this.modal && this.modal.hide();
  }

  async show(options: { vcs: VCS, onPush: () => any }) {
    this.onPush = options.onPush;
    this.modal && this.modal.show();
    await this.updateStatus();
  }

  static renderOperation(entry: StageEntry) {
    let name;
    if (entry.added) {
      name = 'Added';
    } else if (entry.modified) {
      name = 'Modified';
    } else if (entry.deleted) {
      name = 'Deleted';
    } else {
      name = 'Unknown Operation';
    }

    return <code className="txt-sm pad-xxs">{name}</code>;
  }

  render() {
    const { status, message, error, ahead, loadingPush } = this.state;

    const canCreateSnapshot = !!message.trim();
    const canPush = session.isLoggedIn() && ahead > 0;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Push Changes</ModalHeader>
        <ModalBody className="wide pad">
          {error && (
            <p className="notice error margin-bottom-sm no-margin-top">
              <button className="pull-right icon" onClick={this._handleClearError}>
                <i className="fa fa-times" />
              </button>
              {error}
            </p>
          )}
          <div className="form-group">
            <div className="form-control form-control--outlined">
              <textarea
                cols="30"
                rows="3"
                onChange={this._handleMessageChange}
                value={message}
                placeholder="My commit message"
              />
            </div>
            <button
              className="btn btn--clicky"
              onClick={this._handleTakeSnapshot}
              disabled={!canCreateSnapshot}>
              Create Snapshot
            </button>
            {canPush && (
              <button
                className="btn btn--clicky space-left"
                disabled={loadingPush}
                onClick={this._handlePush}>
                {loadingPush ? (
                  <React.Fragment>
                    <i className="fa fa-spin fa-refresh" /> Pushing...
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    Push {ahead} Snapshot{ahead === 1 ? '' : 's'}
                  </React.Fragment>
                )}
              </button>
            )}
          </div>
          <div>
            <button
              className="pull-right btn btn--clicky-small"
              disabled={Object.keys(status.stage).length === 0}
              onClick={this._handleUnstageAll}>
              Uncheck All
            </button>
            <h2>Added Changes</h2>
          </div>
          <ul>
            {Object.keys(status.stage)
              .sort()
              .map(key => (
                <li key={key}>
                  <label>
                    <input
                      className="space-right"
                      type="checkbox"
                      checked={true}
                      name={key}
                      onChange={this._handleUnstage}
                    />
                    {SyncStagingModal.renderOperation(status.stage[key])} {status.stage[key].name}
                  </label>
                </li>
              ))}
          </ul>
          <div>
            <button
              className="pull-right btn btn--clicky-small"
              onClick={this._handleStageAll}
              disabled={Object.keys(status.unstaged).length === 0}>
              Select All ({Object.keys(status.unstaged).length})
            </button>
            <h2>Changes</h2>
          </div>
          <ul key={status.key}>
            {Object.keys(status.unstaged)
              .sort()
              .map(id => (
                <li key={id}>
                  <label>
                    <input
                      className="space-right"
                      type="checkbox"
                      checked={false}
                      name={id}
                      onChange={this._handleStage}
                    />
                    {SyncStagingModal.renderOperation(status.unstaged[id])}{' '}
                    {status.unstaged[id].name}
                  </label>
                </li>
              ))}
          </ul>
        </ModalBody>
      </Modal>
    );
  }
}

export default SyncStagingModal;
