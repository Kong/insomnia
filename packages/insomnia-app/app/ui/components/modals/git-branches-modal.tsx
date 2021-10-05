import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { Fragment, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { database as db } from '../../../common/database';
import type { GitRepository } from '../../../models/git-repository';
import { GitVCS } from '../../../sync/git/git-vcs';
import { initialize as initializeEntities } from '../../redux/modules/entities';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';

interface Props {
  vcs: GitVCS;
  gitRepository: GitRepository;
  handleInitializeEntities: typeof initializeEntities;
  handleGitBranchChanged: (branch: string) => void;
}

interface State {
  error: string;
  branches: string[];
  remoteBranches: string[];
  branch: string;
  newBranchName: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class GitBranchesModal extends PureComponent<Props, State> {
  modal: Modal | null = null;
  input: HTMLInputElement | null = null;
  _onHide: (() => void) | null;

  state: State = {
    error: '',
    branch: '??',
    branches: [],
    remoteBranches: [],
    newBranchName: '',
  };

  _setModalRef(ref: Modal) {
    this.modal = ref;
  }

  _setInputRef(ref: HTMLInputElement) {
    this.input = ref;
  }

  async show(
    options: {
      onHide?: () => void;
    } = {},
  ) {
    await this._refreshState({
      newBranchName: '',
    });
    this._onHide = options.onHide || null;
    this.modal?.show();
    // Focus input when modal shows
    setTimeout(() => {
      this.input?.focus();
    }, 100);
    // Do a fetch of remotes and refresh again. NOTE: we're doing this
    // last because it's super slow
    const { vcs, gitRepository } = this.props;
    await vcs.fetch(false, 1, gitRepository.credentials);
    await this._refreshState();
  }

  async _refreshState(newState?: Record<string, any>) {
    const { vcs, handleGitBranchChanged } = this.props;
    const branch = await vcs.getBranch();
    const branches = await vcs.listBranches();
    const remoteBranches = await vcs.listRemoteBranches();
    this.setState({
      branch,
      branches,
      remoteBranches,
      ...newState,
    });
    handleGitBranchChanged(branch);
  }

  _handleClearError() {
    this.setState({
      error: '',
    });
  }

  _handleHide() {
    if (this._onHide) {
      this._onHide();
    }
  }

  async _errorHandler(cb: () => Promise<void>) {
    try {
      return await cb();
    } catch (err) {
      this.setState({
        error: err.message,
      });
    }
  }

  async _handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    await this._errorHandler(async () => {
      const { vcs } = this.props;
      const { newBranchName } = this.state;
      await vcs.checkout(newBranchName);
      await this._refreshState({
        newBranchName: '',
      });
    });
  }

  async _handleMerge(branch: string) {
    await this._errorHandler(async () => {
      const { vcs } = this.props;
      await vcs.merge(branch);
      // Apparently merge doesn't update the working dir so need to checkout too
      await this._handleCheckout(branch);
    });
  }

  async _handleDelete(branch: string) {
    await this._errorHandler(async () => {
      const { vcs } = this.props;
      await vcs.deleteBranch(branch);
      await this._refreshState();
    });
  }

  async _handleRemoteCheckout(branch: string) {
    await this._errorHandler(async () => {
      const { vcs, gitRepository } = this.props;
      // First fetch more history to make sure we have lots
      await vcs.fetch(true, 20, gitRepository.credentials);
      await this._handleCheckout(branch);
    });
  }

  async _handleCheckout(branch: string) {
    await this._errorHandler(async () => {
      const { vcs, handleInitializeEntities } = this.props;
      const bufferId = await db.bufferChanges();
      await vcs.checkout(branch);
      await db.flushChanges(bufferId, true);
      await handleInitializeEntities();
      await this._refreshState();
    });
  }

  _updateNewBranchName(e: React.SyntheticEvent<HTMLInputElement>) {
    this.setState({
      newBranchName: e.currentTarget.value,
    });
  }

  hide() {
    this.modal?.hide();
  }

  render() {
    const { branch: currentBranch, branches, remoteBranches, newBranchName, error } = this.state;
    const remoteOnlyBranches = remoteBranches.filter(b => !branches.includes(b));
    return (
      <Modal ref={this._setModalRef} onHide={this._handleHide}>
        <ModalHeader>Local Branches</ModalHeader>
        <ModalBody className="pad">
          {error && (
            <p className="notice error margin-bottom-sm no-margin-top">
              <button className="pull-right icon" onClick={this._handleClearError}>
                <i className="fa fa-times" />
              </button>
              {error}
            </p>
          )}
          <form onSubmit={this._handleCreate}>
            <div className="form-row">
              <div className="form-control form-control--outlined">
                <label>
                  New Branch Name
                  <input
                    type="text"
                    ref={this._setInputRef}
                    onChange={this._updateNewBranchName}
                    placeholder="testing-branch"
                    value={newBranchName}
                  />
                </label>
              </div>
              <div className="form-control form-control--no-label width-auto">
                <button type="submit" className="btn btn--clicky" disabled={!newBranchName}>
                  Create
                </button>
              </div>
            </div>
          </form>

          <div className="pad-top">
            <table className="table--fancy table--outlined">
              <thead>
                <tr>
                  <th className="text-left">Branches</th>
                  <th className="text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(name => (
                  <tr key={name} className="table--no-outline-row">
                    <td>
                      <span
                        className={classnames({
                          bold: name === currentBranch,
                        })}
                      >
                        {name}
                      </span>
                      {name === currentBranch ? (
                        <span className="txt-sm space-left">(current)</span>
                      ) : null}
                    </td>
                    <td className="text-right">
                      {name !== currentBranch && (
                        <Fragment>
                          <PromptButton
                            className="btn btn--micro btn--outlined space-left"
                            doneMessage="Merged"
                            onClick={() => this._handleMerge(name)}
                          >
                            Merge
                          </PromptButton>
                          <PromptButton
                            className="btn btn--micro btn--outlined space-left"
                            doneMessage="Deleted"
                            onClick={() => this._handleDelete(name)}
                          >
                            Delete
                          </PromptButton>
                          <button
                            className="btn btn--micro btn--outlined space-left"
                            onClick={() => this._handleCheckout(name)}
                          >
                            Checkout
                          </button>
                        </Fragment>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {remoteOnlyBranches.length > 0 && (
            <div className="pad-top">
              <table className="table--fancy table--outlined">
                <thead>
                  <tr>
                    <th className="text-left">Remote Branches</th>
                    <th className="text-right">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {remoteOnlyBranches.map(name => (
                    <tr key={name} className="table--no-outline-row">
                      <td>{name}</td>
                      <td className="text-right">
                        <button
                          className="btn btn--micro btn--outlined space-left"
                          onClick={() => this._handleRemoteCheckout(name)}
                        >
                          Checkout
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm">
            <i className="fa fa-code-fork" /> {currentBranch}
          </div>
          <div>
            <button className="btn" onClick={this.hide}>
              Done
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}
