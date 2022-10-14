import classnames from 'classnames';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { interceptAccessError } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import { selectSyncItems } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { SyncPullButton } from '../sync-pull-button';

type Props = ModalProps & {
  vcs: VCS;
};
export interface SyncBranchesModalOptions {
  error: string;
  newBranchName: string;
  currentBranch: string;
  branches: string[];
  remoteBranches: string[];
  onHide?: () => void;
}
export interface SyncBranchesModalHandle {
  show: (options: SyncBranchesModalOptions) => void;
  hide: () => void;
}
export const SyncBranchesModal = forwardRef<SyncBranchesModalHandle, Props>(({ vcs }, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<SyncBranchesModalOptions>({
    error: '',
    newBranchName: '',
    branches: [],
    remoteBranches: [],
    currentBranch: '',
  });

  const refreshState = useCallback(async () => {
    try {
      const currentBranch = await vcs.getBranch();
      const branches = (await vcs.getBranches()).sort();
      setState(state => ({
        ...state,
        branches,
        currentBranch,
        error: '',
      }));

      const remoteBranches = await interceptAccessError({
        callback: async () => (await vcs.getRemoteBranches()).filter(b => !branches.includes(b)).sort(),
        action: 'get',
        resourceName: 'remote',
        resourceType: 'branches',
      });
      setState(state => ({
        ...state,
        remoteBranches,
      }));
    } catch (err) {
      console.log('Failed to refresh', err.stack);
      setState(state => ({
        ...state,
        error: err.message,
      }));
    }
  }, [vcs]);
  useImperativeHandle(ref, () => ({
    hide: () => modalRef.current?.hide(),
    show: ({ onHide }) => {
      setState(state => ({
        ...state,
        onHide,
      }));
      refreshState();
      modalRef.current?.show({ onHide });
    },
  }), [refreshState]);
  const syncItems = useSelector(selectSyncItems);
  async function handleCheckout(branch: string) {
    try {
      const delta = await vcs.checkout(syncItems, branch);
      // @ts-expect-error -- TSCONVERSION
      await db.batchModifyDocs(delta);
      await refreshState();
    } catch (err) {
      console.log('Failed to checkout', err.stack);
      setState(state => ({
        ...state,
        error: err.message,
      }));
    }
  }
  const handleMerge = async (branch: string) => {
    const delta = await vcs.merge(syncItems, branch);
    try {
      // @ts-expect-error -- TSCONVERSION
      await db.batchModifyDocs(delta);
      await refreshState();
    } catch (err) {
      console.log('Failed to merge', err.stack);
      setState(state => ({
        ...state,
        error: err.message,
      }));
    }
  };

  const handleRemoteDelete = async (branch: string) => {
    try {
      await vcs.removeRemoteBranch(branch);
      await refreshState();
    } catch (err) {
      console.log('Failed to remote delete', err.stack);
      setState(state => ({
        ...state,
        error: err.message,
      }));
    }
  };

  const handleDelete = async (branch: string) => {
    try {
      await vcs.removeBranch(branch);
      await refreshState();
    } catch (err) {
      console.log('Failed to delete', err.stack);
      setState(state => ({
        ...state,
        error: err.message,
      }));
    }
  };

  const handleCreate = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      // Create new branch
      const { newBranchName } = state;
      await vcs.fork(newBranchName);
      // Checkout new branch
      const delta = await vcs.checkout(syncItems, newBranchName);
      // @ts-expect-error -- TSCONVERSION
      await db.batchModifyDocs(delta);
      // Clear branch name and refresh things
      await refreshState();
      setState(state => ({
        ...state,
        newBranchName: '',
      }));
    } catch (err) {
      console.log('Failed to create', err.stack);
      setState(state => ({
        ...state,
        error: err.message,
      }));
    }
  };
  const { branches, remoteBranches, currentBranch, newBranchName, error } = state;

  return (
    <Modal ref={modalRef}>
      <ModalHeader>Branches</ModalHeader>
      <ModalBody className="wide pad">
        {error && (
          <p className="notice error margin-bottom-sm no-margin-top">
            <button className="pull-right icon" onClick={() => setState(state => ({ ...state, error: '' }))}>
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
                  onChange={event => setState(state => ({ ...state, newBranchName: event.target.value }))}
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
                    {name === 'master' && <i className="fa fa-lock space-left faint" />}
                  </td>
                  <td className="text-right">
                    <PromptButton
                      className="btn btn--micro btn--outlined space-left"
                      doneMessage="Merged"
                      disabled={name === currentBranch}
                      onClick={() => handleMerge(name)}
                    >
                      Merge
                    </PromptButton>
                    <PromptButton
                      className="btn btn--micro btn--outlined space-left"
                      doneMessage="Deleted"
                      disabled={name === currentBranch || name === 'master'}
                      onClick={() => handleDelete(name)}
                    >
                      Delete
                    </PromptButton>
                    <button
                      className="btn btn--micro btn--outlined space-left"
                      disabled={name === currentBranch}
                      onClick={() => handleCheckout(name)}
                    >
                      Checkout
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {remoteBranches.length > 0 && (
          <div className="pad-top">
            <table className="table--fancy table--outlined">
              <thead>
                <tr>
                  <th className="text-left">Remote Branches</th>
                  <th className="text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {remoteBranches.map(name => (
                  <tr key={name} className="table--no-outline-row">
                    <td>
                      {name}
                      {name === 'master' && <i className="fa fa-lock space-left faint" />}
                    </td>
                    <td className="text-right">
                      {name !== 'master' && (
                        <PromptButton
                          className="btn btn--micro btn--outlined space-left"
                          doneMessage="Deleted"
                          disabled={name === currentBranch}
                          onClick={() => handleRemoteDelete(name)}
                        >
                          Delete
                        </PromptButton>
                      )}
                      <SyncPullButton
                        className="btn btn--micro btn--outlined space-left"
                        branch={name}
                        onPull={refreshState}
                        disabled={name === currentBranch}
                        vcs={vcs}
                      >
                        Fetch
                      </SyncPullButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModalBody>
    </Modal >
  );
});
SyncBranchesModal.displayName = 'SyncBranchesModal';
