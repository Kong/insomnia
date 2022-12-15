import classnames from 'classnames';
import React, { FC, useEffect, useRef } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useParams } from 'react-router-dom';

import { GitRepository } from '../../../models/git-repository';
import { CreateNewGitBranchResult } from '../../routes/git-actions';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { showAlert } from '.';

type Props = ModalProps & {
  branches: string[];
  remoteBranches: string[];
  activeBranch: string;
  gitRepository: GitRepository | null;
};

export interface GitBranchesModalOptions {
  onCheckout: () => void;
}

export const GitBranchesModal: FC<Props> = (({
  onHide,
  branches,
  activeBranch,
  remoteBranches,
}) => {
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string};
  const modalRef = useRef<ModalHandle>(null);

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const checkoutBranchFetcher = useFetcher();
  const mergeBranchFetcher = useFetcher();
  const newBranchFetcher = useFetcher<CreateNewGitBranchResult>();
  const deleteBranchFetcher = useFetcher();

  const remoteOnlyBranches = remoteBranches.filter(b => !branches.includes(b));

  useEffect(() => {
    if (newBranchFetcher.data?.errors?.length) {
      showAlert({
        title: 'Push Failed',
        message: newBranchFetcher.data.errors.join('\n'),
      });
    }
  }, [newBranchFetcher.data?.errors]);

  return (
    <OverlayContainer>
      <Modal ref={modalRef} onHide={onHide}>
        <ModalHeader>Branches</ModalHeader>
        <ModalBody className="pad">
          <newBranchFetcher.Form
            method="post"
            action={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/branch/new`}
          >
            <div className="form-row">
              <div className="form-control form-control--outlined">
                <label>
                  New Branch Name
                  <input
                    type="text"
                    autoFocus
                    name="branch"
                    required
                    placeholder="testing-branch"
                  />
                </label>
              </div>
              <div className="form-control form-control--no-label width-auto">
                <button disabled={newBranchFetcher.state === 'loading'} type="submit" className="btn btn--clicky">
                  <i className='fa fa-plus space-right' /> Create
                </button>
              </div>
            </div>
          </newBranchFetcher.Form>

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
                          bold: branch === activeBranch,
                        })}
                      >
                        {branch}
                      </span>
                      {branch === activeBranch ? (
                        <span className="txt-sm space-left">(current)</span>
                      ) : null}
                    </td>
                    <td className="text-right">
                      {branch !== activeBranch && (
                        <>
                          <PromptButton
                            className="btn btn--micro btn--outlined space-left"
                            doneMessage="Merged"
                            onClick={async () => {
                              mergeBranchFetcher.submit({
                                branch,
                              }, {
                                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/branch/merge`,
                                method: 'post',
                              });
                            }}
                          >
                            Merge
                          </PromptButton>
                          <PromptButton
                            className="btn btn--micro btn--outlined space-left"
                            doneMessage="Deleted"
                            onClick={async () => {
                              deleteBranchFetcher.submit({
                                branch,
                              }, {
                                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/branch/delete`,
                                method: 'post',
                              });
                            }}
                          >
                            Delete
                          </PromptButton>
                          <button
                            className="btn btn--micro btn--outlined space-left"
                            onClick={() => {
                              checkoutBranchFetcher.submit({
                                branch,
                              }, {
                                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/branch/checkout`,
                                method: 'post',
                              });
                            }}
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
                            checkoutBranchFetcher.submit({
                              branch,
                            }, {
                              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/branch/checkout`,
                              method: 'post',
                            });
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
            <i className="fa fa-code-fork" /> {activeBranch}
          </div>
          <div>
            <button className="btn" onClick={() => modalRef.current?.hide()}>
              Done
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
});
GitBranchesModal.displayName = 'GitBranchesModal';
