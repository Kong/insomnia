import classnames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useRouteLoaderData } from 'react-router-dom';

import { database as db, Operation } from '../../../common/database';
import { interceptAccessError } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { SyncPullButton } from '../sync-pull-button';

type Props = ModalProps & {
  vcs: VCS;
};

interface State {
  error?: string;
  currentBranch: string;
  branches: string[];
  remoteBranches: string[];
}
export interface SyncBranchesModalOptions {
  onHide?: () => void;
}
export interface SyncBranchesModalHandle {
  show: (options: SyncBranchesModalOptions) => void;
  hide: () => void;
}
export const SyncBranchesModal = ({ vcs, onHide }: Props) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({
    error: '',
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
  useEffect(() => {
    modalRef.current?.show();
    refreshState();
  }, [refreshState]);

  const {
    syncItems,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  async function handleCheckout(branch: string) {
    try {
      const delta = await vcs.checkout(syncItems, branch);
      await db.batchModifyDocs(delta as Operation);
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
      await db.batchModifyDocs(delta as Operation);
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
      const formData = new FormData(event.currentTarget);
      const newBranchName = formData.get('newName') as string;
      if (!newBranchName) {
        return;
      }
      await vcs.fork(newBranchName);
      // Checkout new branch
      const delta = await vcs.checkout(syncItems, newBranchName);
      await db.batchModifyDocs(delta as Operation);
      // Clear branch name and refresh things
      await refreshState();

    } catch (err) {
      console.log('Failed to create', err.stack);
      setState(state => ({
        ...state,
        error: err.message,
      }));
    }
  };
  const { branches, remoteBranches, currentBranch, error } = state;

  return (
    <OverlayContainer>
      <Modal ref={modalRef} onHide={onHide}>
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
                    name="newName"
                    placeholder="testing-branch"
                  />
                </label>
              </div>
              <div className="form-control form-control--no-label width-auto">
                <button type="submit" className="btn btn--clicky">
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
      </Modal>
    </OverlayContainer>
  );
};
SyncBranchesModal.displayName = 'SyncBranchesModal';
