import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { Fragment, PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { BaseModel } from '../../../models';
import type { Workspace } from '../../../models/workspace';
import type { DocumentKey, Stage, StageEntry, Status, StatusCandidate } from '../../../sync/types';
import { describeChanges } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import IndeterminateCheckbox from '../base/indeterminate-checkbox';
import Modal from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import Tooltip from '../tooltip';

interface Props {
  workspace: Workspace;
  syncItems: StatusCandidate[];
  vcs: VCS;
}

interface State {
  status: Status;
  message: string;
  error: string;
  branch: string;
  lookupMap: Record<
    string,
    {
      entry: StageEntry;
      changes: null | string[];
      type: string;
      checked: boolean;
    }
  >;
}

const _initialState: State = {
  status: {
    stage: {},
    unstaged: {},
    key: '',
  },
  branch: '',
  error: '',
  message: '',
  lookupMap: {},
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class SyncStagingModal extends PureComponent<Props, State> {
  modal: Modal | null = null;
  _onSnapshot: (() => void) | null = null;
  _handlePush: (() => Promise<void>) | null = null;
  textarea: HTMLTextAreaElement | null = null;
  state = _initialState;

  _setModalRef(m: Modal) {
    this.modal = m;
  }

  _setTextAreaRef(m: HTMLTextAreaElement) {
    this.textarea = m;
  }

  _handleClearError() {
    this.setState({ error: '' });
  }

  _handleMessageChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    this.setState({ message: e.currentTarget.value });
  }

  async _handleStageToggle(e: React.SyntheticEvent<HTMLInputElement>) {
    const { vcs } = this.props;
    const { status } = this.state;
    const id = e.currentTarget.name;
    const isStaged = !!status.stage[id];
    const newStage = isStaged
      ? await vcs.unstage(status.stage, [status.stage[id]])
      : await vcs.stage(status.stage, [status.unstaged[id]]);
    await this.refreshMainAttributes({}, newStage);
  }

  async _handleAllToggle(keys: DocumentKey[], doStage: boolean) {
    const { vcs } = this.props;
    const { status } = this.state;
    let stage;

    if (doStage) {
      const entries: StageEntry[] = [];

      for (const k of Object.keys(status.unstaged)) {
        if (keys.includes(k)) {
          entries.push(status.unstaged[k]);
        }
      }

      stage = await vcs.stage(status.stage, entries);
    } else {
      const entries: StageEntry[] = [];

      for (const k of Object.keys(status.stage)) {
        if (keys.includes(k)) {
          entries.push(status.stage[k]);
        }
      }

      stage = await vcs.unstage(status.stage, entries);
    }

    await this.refreshMainAttributes({}, stage);
  }

  async _handleTakeSnapshotAndPush() {
    const success = await this._handleTakeSnapshot();

    if (success) {
      this._handlePush?.();
    }
  }

  async _handleTakeSnapshot() {
    const { vcs } = this.props;
    const {
      message,
      status: { stage },
    } = this.state;

    try {
      await vcs.takeSnapshot(stage, message);
    } catch (err) {
      this.setState({
        error: err.message,
      });
      return false;
    }

    this._onSnapshot?.();
    await this.refreshMainAttributes({
      message: '',
      error: '',
    });
    this.hide();
    return true;
  }

  async refreshMainAttributes(newState: Partial<State> = {}, newStage: Stage = {}) {
    const { vcs, syncItems } = this.props;
    const branch = await vcs.getBranch();
    const status = await vcs.status(syncItems, newStage);
    const lookupMap = {};
    const allKeys = [...Object.keys(status.stage), ...Object.keys(status.unstaged)];

    for (const key of allKeys) {
      const item = syncItems.find(si => si.key === key);
      const oldDoc: BaseModel | null = await vcs.blobFromLastSnapshot(key);
      const doc = (item && item.document) || oldDoc;
      const entry = status.stage[key] || status.unstaged[key];

      if (!entry || !doc) {
        continue;
      }

      let changes: string[] | null = null;

      if (item && item.document && oldDoc) {
        changes = describeChanges(item.document, oldDoc);
      }

      lookupMap[key] = {
        changes,
        entry: entry,
        type: models.getModelName(doc.type),
        checked: !!status.stage[key],
      };
    }

    // @ts-expect-error -- TSCONVERSION
    this.setState({
      status,
      branch,
      lookupMap,
      error: '',
      ...newState,
    });
  }

  hide() {
    this.modal?.hide();
  }

  async show(options: { onSnapshot?: () => any; handlePush: () => Promise<void> }) {
    const { vcs, syncItems } = this.props;
    this.modal?.show();
    // @ts-expect-error -- TSCONVERSION
    this._onSnapshot = options.onSnapshot;
    this._handlePush = options.handlePush;
    // Reset state
    this.setState(_initialState);
    // Add everything to stage by default except new items
    const status: Status = await vcs.status(syncItems, {});
    const toStage: StageEntry[] = [];

    for (const key of Object.keys(status.unstaged)) {
      // @ts-expect-error -- TSCONVERSION
      if (status.unstaged[key].added) {
        // Don't automatically stage added resources
        continue;
      }

      toStage.push(status.unstaged[key]);
    }

    const stage = await vcs.stage(status.stage, toStage);
    await this.refreshMainAttributes({}, stage);
    this.textarea?.focus();
  }

  static renderOperation(entry: StageEntry, type: string, changes: string[]) {
    let child: JSX.Element | null = null;
    let message = '';

    // @ts-expect-error -- TSCONVERSION type narrowing
    if (entry.added) {
      child = <i className="fa fa-plus-circle success" />;
      message = 'Added';
      // @ts-expect-error -- TSCONVERSION type narrowing
    } else if (entry.modified) {
      child = <i className="fa fa-circle faded" />;
      message = `Modified (${changes.join(', ')})`;
      // @ts-expect-error -- TSCONVERSION type narrowing
    } else if (entry.deleted) {
      child = <i className="fa fa-minus-circle danger" />;
      message = 'Deleted';
    } else {
      child = <i className="fa fa-question-circle info" />;
      message = 'Unknown';
    }

    if (type === models.workspace.type) {
      type = strings.collection.singular;
    }

    return (
      <Fragment>
        <Tooltip message={message}>
          {child} {type}
        </Tooltip>
      </Fragment>
    );
  }

  renderTable(keys: DocumentKey[], title: ReactNode) {
    const { status, lookupMap } = this.state;

    if (keys.length === 0) {
      return null;
    }

    let allUnChecked = true;
    let allChecked = true;

    for (const key of keys.sort()) {
      if (!status.stage[key]) {
        allChecked = false;
      }

      if (!status.unstaged[key]) {
        allUnChecked = false;
      }
    }

    const indeterminate = !allChecked && !allUnChecked;
    return (
      <div className="pad-top">
        <strong>{title}</strong>
        <table className="table--fancy table--outlined margin-top-sm">
          <thead>
            <tr>
              <th>
                <label className="wide no-pad">
                  <span className="txt-md">
                    <IndeterminateCheckbox
                      className="space-right"
                      checked={allChecked}
                      onChange={() => this._handleAllToggle(keys, allUnChecked)}
                      indeterminate={indeterminate}
                    />
                  </span>{' '}
                  name
                </label>
              </th>
              <th className="text-right ">Changes</th>
              <th className="text-right">Description</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(key => {
              if (!lookupMap[key]) {
                return null;
              }

              const { entry, type, checked, changes } = lookupMap[key];
              return (
                <tr key={key} className="table--no-outline-row">
                  <td>
                    <label className="no-pad wide">
                      <input
                        className="space-right"
                        type="checkbox"
                        checked={checked}
                        name={key}
                        onChange={this._handleStageToggle}
                      />{' '}
                      {entry.name}
                    </label>
                  </td>
                  <td className="text-right">{changes ? changes.join(', ') : '--'}</td>
                  <td className="text-right">
                    {SyncStagingModal.renderOperation(entry, type, changes || [])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  render() {
    const { status, message, error, branch } = this.state;
    const nonAddedKeys: string[] = [];
    const addedKeys: string[] = [];
    const allMap = { ...status.stage, ...status.unstaged };
    const allKeys = Object.keys(allMap);

    for (const key of allKeys) {
      // @ts-expect-error -- TSCONVERSION
      if (allMap[key].added) {
        addedKeys.push(key);
      } else {
        nonAddedKeys.push(key);
      }
    }

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Create Snapshot</ModalHeader>
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
              <label>
                Snapshot Message
                <textarea
                  ref={this._setTextAreaRef}
                  cols={30}
                  rows={3}
                  onChange={this._handleMessageChange}
                  value={message}
                  placeholder="This is a helpful message that describe the changes made in this snapshot"
                  required
                />
              </label>
            </div>
          </div>

          {this.renderTable(nonAddedKeys, 'Modified Objects')}
          {this.renderTable(addedKeys, 'Unversioned Objects')}
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm">
            <i className="fa fa-code-fork" /> {branch}
          </div>
          <div>
            <button className="btn" onClick={this._handleTakeSnapshot}>
              Create
            </button>
            <button className="btn" onClick={this._handleTakeSnapshotAndPush}>
              Create and Push
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default SyncStagingModal;
