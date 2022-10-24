import classnames from 'classnames';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { SegmentEvent, trackSegmentEvent, vcsSegmentEventProperties } from '../../../common/analytics';
import { database as db } from '../../../common/database';
import { GitVCS } from '../../../sync/git/git-vcs';
import { getOauth2FormatName } from '../../../sync/git/utils';
import { initialize as initializeEntities } from '../../redux/modules/entities';
import { selectActiveGitRepository } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';

type Props = ModalProps & {
  vcs: GitVCS;
};
export interface GitBranchesModalOptions {
  onCheckout: () => void;
}
export interface State {
  error: string;
  branches: string[];
  remoteBranches: string[];
  branch: string;
  newBranchName: string;
  onCheckout: () => void;
}
export interface GitBranchesModalHandle {
  show: (options: GitBranchesModalOptions) => void;
  hide: () => void;
}
export const GitBranchesModal = forwardRef<GitBranchesModalHandle, Props>(({ vcs }, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({
    error: '',
    branch: '??',
    branches: [],
    remoteBranches: [],
    newBranchName: '',
    onCheckout: () => {},
  });
  const dispatch = useDispatch();
  const gitRepository = useSelector(selectActiveGitRepository);
  const refreshState = useCallback(async () => {
    const branch = await vcs.getBranch();
    const branches = await vcs.listBranches();
    const remoteBranches = await vcs.listRemoteBranches();
    setState(state => ({
      ...state,
      branch,
      branches,
      remoteBranches,
    }));
  }, [vcs]);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async ({ onCheckout }) => {
      setState(state => ({ ...state, newBranchName: '', onCheckout }));
      await refreshState();
      modalRef.current?.show({ onHide: onCheckout });
      // Do a fetch of remotes and refresh again. NOTE: we're doing this
      // last because it's super slow
      await vcs.fetch(false, 1, gitRepository?.credentials);
      await refreshState();
    },
  }), [refreshState, vcs, gitRepository?.credentials]);

  const handleCheckout = async (branch: string) => {
    try {
      const bufferId = await db.bufferChanges();
      const providerName = getOauth2FormatName(gitRepository?.credentials);
      await vcs.checkout(branch);
      trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'checkout_branch'), providerName });
      await db.flushChanges(bufferId, true);
      await dispatch(initializeEntities());
      await refreshState();
      state.onCheckout?.();
    } catch (err) {
      setState(state => ({ ...state, error: err.message }));
    }
  };
  const { branch: currentBranch, branches, remoteBranches, newBranchName, error, onCheckout } = state;
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
        <form
          onSubmit={async event => {
            event.preventDefault();
            try {
              const providerName = getOauth2FormatName(gitRepository?.credentials);
              await vcs.checkout(state.newBranchName);
              trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'create_branch'), providerName });
              setState({ ...state, newBranchName: '' });
              refreshState();
              onCheckout?.();
            } catch (err) {
              setState(state => ({ ...state, error: err.message }));
            }
          }}
        >
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
              {branches.map(branch => (
                <tr key={branch} className="table--no-outline-row">
                  <td>
                    <span
                      className={classnames({
                        bold: branch === currentBranch,
                      })}
                    >
                      {branch}
                    </span>
                    {branch === currentBranch ? (
                      <span className="txt-sm space-left">(current)</span>
                    ) : null}
                  </td>
                  <td className="text-right">
                    {branch !== currentBranch && (
                      <>
                        <PromptButton
                          className="btn btn--micro btn--outlined space-left"
                          doneMessage="Merged"
                          onClick={async () => {
                            try {
                              const providerName = getOauth2FormatName(gitRepository?.credentials);
                              await vcs.merge(branch);
                              // Apparently merge doesn't update the working dir so need to checkout too
                              await handleCheckout(branch);
                              trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'merge_branch'), providerName });
                            } catch (err) {
                              setState(state => ({ ...state, error: err.message }));
                            }
                          }}
                        >
                          Merge
                        </PromptButton>
                        <PromptButton
                          className="btn btn--micro btn--outlined space-left"
                          doneMessage="Deleted"
                          onClick={async () => {
                            try {
                              const providerName = getOauth2FormatName(gitRepository?.credentials);
                              await vcs.deleteBranch(branch);
                              trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'delete_branch'), providerName });
                              refreshState();
                            } catch (err) {
                              setState(state => ({ ...state, error: err.message }));
                            }
                          }}
                        >
                          Delete
                        </PromptButton>
                        <button
                          className="btn btn--micro btn--outlined space-left"
                          onClick={() => handleCheckout(branch)}
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
                {remoteOnlyBranches.map(branch => (
                  <tr key={branch} className="table--no-outline-row">
                    <td>{branch}</td>
                    <td className="text-right">
                      <button
                        className="btn btn--micro btn--outlined space-left"
                        onClick={async () => {
                          try {
                            // First fetch more history to make sure we have lots
                            await vcs.fetch(true, 20, gitRepository?.credentials);
                            handleCheckout(branch);
                          } catch (err) {
                            setState(state => ({ ...state, error: err.message }));
                          }
                        }}
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
