import classnames from 'classnames';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';

import { SegmentEvent, trackSegmentEvent, vcsSegmentEventProperties } from '../../../common/analytics';
import { database as db } from '../../../common/database';
import type { GitRepository } from '../../../models/git-repository';
import { GitVCS } from '../../../sync/git/git-vcs';
import { getOauth2FormatName } from '../../../sync/git/utils';
import { initialize as initializeEntities } from '../../redux/modules/entities';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';

type Props = ModalProps & {
  vcs: GitVCS;
  gitRepository: GitRepository;
};
export interface GitBranchesModalOptions {
  onHide: () => void;
}
export interface State {
  error: string;
  branches: string[];
  remoteBranches: string[];
  branch: string;
  newBranchName: string;
}
export interface GitBranchesModalHandle {
  show: (options: GitBranchesModalOptions) => void;
  hide: () => void;
}
export const GitBranchesModal = forwardRef<GitBranchesModalHandle, Props>(({ vcs, gitRepository, handleGitBranchChanged }, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({
    error: '',
    branch: '??',
    branches: [],
    remoteBranches: [],
    newBranchName: '',
  });
  const dispatch = useDispatch();
  const refreshState = useCallback(async () => {
    const branch = await vcs.getBranch();
    const branches = await vcs.listBranches();
    const remoteBranches = await vcs.listRemoteBranches();
    setState({
      ...state,
      branch,
      branches,
      remoteBranches,
    });
    handleGitBranchChanged(branch);
  }, [handleGitBranchChanged, state, vcs]);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async ({ onHide }) => {
      setState({ ...state, newBranchName: '' });
      await refreshState();
      modalRef.current?.show({ onHide });
      // Do a fetch of remotes and refresh again. NOTE: we're doing this
      // last because it's super slow
      await vcs.fetch(false, 1, gitRepository.credentials);
      await refreshState();
    },
  }), [state, refreshState, vcs, gitRepository.credentials]);

  const handleCreate = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const providerName = getOauth2FormatName(gitRepository.credentials);
      await vcs.checkout(state.newBranchName);
      trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'create_branch'), providerName });
      setState({ ...state, newBranchName: '' });
      await refreshState();
    } catch (err) {
      setState({
        ...state,
        error: err.message,
      });
    }
  };

  const handleMerge = async (branch: string) => {
    try {
      const providerName = getOauth2FormatName(gitRepository.credentials);
      await vcs.merge(branch);
      // Apparently merge doesn't update the working dir so need to checkout too
      await handleCheckout(branch);
      trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'merge_branch'), providerName });
    } catch (err) {
      setState({
        ...state,
        error: err.message,
      });
    }
  };

  const handleDelete = async (branch: string) => {
    try {
      const providerName = getOauth2FormatName(gitRepository.credentials);
      await vcs.deleteBranch(branch);
      trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'delete_branch'), providerName });
      await refreshState();
    } catch (err) {
      setState({
        ...state,
        error: err.message,
      });
    }
  };

  const handleRemoteCheckout = async (branch: string) => {
    try {
      // First fetch more history to make sure we have lots
      await vcs.fetch(true, 20, gitRepository.credentials);
      await handleCheckout(branch);
    } catch (err) {
      setState({
        ...state,
        error: err.message,
      });
    }
  };

  const handleCheckout = async (branch: string) => {
    try {
      const bufferId = await db.bufferChanges();
      const providerName = getOauth2FormatName(gitRepository.credentials);
      await vcs.checkout(branch);
      trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'checkout_branch'), providerName });
      await db.flushChanges(bufferId, true);
      await dispatch(initializeEntities());
      await refreshState();
    } catch (err) {
      setState({
        ...state,
        error: err.message,
      });
    }
  };
  const { branch: currentBranch, branches, remoteBranches, newBranchName, error } = state;
  const remoteOnlyBranches = remoteBranches.filter(b => !branches.includes(b));
  return (
    <Modal ref={modalRef}>
      <ModalHeader>Local Branches</ModalHeader>
      <ModalBody className="pad">
        {error && (
          <p className="notice error margin-bottom-sm no-margin-top">
            <button className="pull-right icon" onClick={() => setState({ ...state, error: '' })}>
              <i className="fa fa-times" />
            </button>
            {error}
          </p>
        )}
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-control form-control--outlined">
              <label>
                New Branch Name
                <input
                  type="text"
                  onChange={event => {
                    setState({ ...state, newBranchName: event.currentTarget.value });
                  }}
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
                      <>
                        <PromptButton
                          className="btn btn--micro btn--outlined space-left"
                          doneMessage="Merged"
                          onClick={() => handleMerge(name)}
                        >
                          Merge
                        </PromptButton>
                        <PromptButton
                          className="btn btn--micro btn--outlined space-left"
                          doneMessage="Deleted"
                          onClick={() => handleDelete(name)}
                        >
                          Delete
                        </PromptButton>
                        <button
                          className="btn btn--micro btn--outlined space-left"
                          onClick={() => handleCheckout(name)}
                        >
                          Checkout
                        </button>
                      </>
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
                        onClick={() => handleRemoteCheckout(name)}
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
          <button className="btn" onClick={() => modalRef.current?.hide()}>
            Done
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
});
GitBranchesModal.displayName = 'GitBranchesModal';
