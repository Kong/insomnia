import classnames from 'classnames';
import React, { useEffect, useRef } from 'react';
import { OverlayContainer } from 'react-aria';
import { Button } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { VCS } from '../../../sync/vcs/vcs';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { Icon } from '../icon';
import { SyncPullButton } from '../sync-pull-button';

type Props = ModalProps & {
  vcs: VCS;
  branches: string[];
  remoteBranches: string[];
  currentBranch: string;
};

export interface SyncBranchesModalOptions {
  onHide?: () => void;
}
export interface SyncBranchesModalHandle {
  show: (options: SyncBranchesModalOptions) => void;
  hide: () => void;
}
export const SyncBranchesModal = ({ vcs, onHide, branches, remoteBranches, currentBranch }: Props) => {
  const modalRef = useRef<ModalHandle>(null);

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const checkoutBranchFetcher = useFetcher();
  const mergeBranchFetcher = useFetcher();
  const deleteBranchFetcher = useFetcher();
  const createBranchFetcher = useFetcher();

  return (
    <OverlayContainer>
      <Modal ref={modalRef} onHide={onHide}>
        <ModalHeader>Branches</ModalHeader>
        <ModalBody className="wide pad">
          <form
            onSubmit={e => {
              e.preventDefault();
              createBranchFetcher.submit(e.currentTarget, {
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/create`,
                method: 'POST',
              });
            }}
          >
            <div className="form-row">
              <div className="form-control form-control--outlined">
                <label>
                  New branch name
                  <input
                    type="text"
                    name="branchName"
                    placeholder="testing-branch"
                  />
                </label>
              </div>
              <div className="form-control form-control--no-label width-auto">
                <Button className={'btn btn--clicky flex gap-2 items-center aria-disabled:opacity-50 aria-disabled:cursor-not-allowed'} isDisabled={createBranchFetcher.state !== 'idle'} type="submit">
                  <Icon className={`w-5 ${createBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`} icon={createBranchFetcher.state !== 'idle' ? 'spinner' : 'plus'} /> Create
                </Button>
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
                        onClick={() => mergeBranchFetcher.submit({
                          branch: name,
                        }, {
                          method: 'POST',
                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/merge`,
                        })}
                      >
                        Merge
                      </PromptButton>
                      <PromptButton
                        className="btn btn--micro btn--outlined space-left"
                        doneMessage="Deleted"
                        disabled={name === currentBranch || name === 'master'}
                        onClick={() => deleteBranchFetcher.submit(
                          {
                            branch: name,
                          },
                          {
                            method: 'POST',
                            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/delete`,
                          },
                        )}
                      >
                        Delete
                      </PromptButton>
                      <button
                        className="btn btn--micro btn--outlined space-left"
                        disabled={name === currentBranch}
                        onClick={() => checkoutBranchFetcher.submit({
                          branch: name,
                        }, {
                          method: 'POST',
                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/checkout`,
                        })}
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
                            onClick={() => deleteBranchFetcher.submit(
                              {
                                branch: name,
                              },
                              {
                                method: 'POST',
                                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/delete`,
                              },
                            )}
                          >
                            Delete
                          </PromptButton>
                        )}
                        <SyncPullButton
                          className="btn btn--micro btn--outlined space-left"
                          branch={name}
                          onPull={console.log}
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
