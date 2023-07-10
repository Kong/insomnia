import classnames from 'classnames';
import React, { FC, useEffect, useRef } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useParams } from 'react-router-dom';

import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { CommitToGitRepoResult, GitChangesLoaderData, GitRollbackChangesResult } from '../../routes/git-actions';
import { IndeterminateCheckbox } from '../base/indeterminate-checkbox';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { Tooltip } from '../tooltip';
import { showAlert } from '.';

interface Item {
  path: string;
  type: string;
  status: string;
  staged: boolean;
  added: boolean;
  editable: boolean;
}

export const GitStagingModal: FC<ModalProps> = ({
  onHide,
}) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const modalRef = useRef<ModalHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [checkAllModified, setCheckAllModified] = React.useState(false);
  const [checkAllUnversioned, setCheckAllUnversioned] = React.useState(false);
  const gitChangesFetcher = useFetcher<GitChangesLoaderData>();
  const gitCommitFetcher = useFetcher<CommitToGitRepoResult>();
  const rollbackFetcher = useFetcher<GitRollbackChangesResult>();

  const isLoadingGitChanges = gitChangesFetcher.state !== 'idle';

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  useEffect(() => {
    if (gitChangesFetcher.state === 'idle' && !gitChangesFetcher.data) {
      gitChangesFetcher.load(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/changes`);
    }
  }, [organizationId, projectId, workspaceId, gitChangesFetcher]);

  const {
    changes,
    branch,
    statusNames,
  } = gitChangesFetcher.data || {
    changes: [],
    branch: '',
    statusNames: {},
  };

  const hasChanges = Boolean(changes.length);

  const modifiedChanges = changes.filter(i => !i.status.includes('added'));
  const unversionedChanges = changes.filter(i => i.status.includes('added'));

  const errors = gitCommitFetcher.data?.errors || rollbackFetcher.data?.errors;

  useEffect(() => {
    if (errors && errors?.length > 0) {
      showAlert({
        title: 'Push Failed',
        message: errors.join('\n'),
      });
    }
  }, [errors]);

  return (
    <OverlayContainer>
      <Modal onHide={onHide} ref={modalRef}>
        <ModalHeader>Commit Changes</ModalHeader>
        <ModalBody className="wide pad">
          <gitCommitFetcher.Form
            id="git-staging-form"
            method="post"
            ref={formRef}
            action={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/commit`}
          >
            {hasChanges ? (
              <>
                <div className="form-control form-control--outlined">
                  <textarea
                    rows={3}
                    required
                    placeholder="A descriptive message to describe changes made"
                    name="message"
                  />
                </div>
                {modifiedChanges.length > 0 && (
                  <div className="pad-top">
                    <strong>Modified Objects</strong>
                    <PromptButton
                      className="btn pull-right btn--micro"
                      onClick={e => {
                        e.preventDefault();
                        if (formRef.current) {
                          const data = new FormData(formRef.current);
                          data.append('changeType', 'modified');

                          rollbackFetcher.submit(data, {
                            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/rollback`,
                            method: 'post',
                          });
                        }
                      }}
                    >
                      Rollback All
                    </PromptButton>
                    <table className="table--fancy table--outlined margin-top-sm">
                      <thead>
                        <tr className="table--no-outline-row">
                          <th>
                            <label className="wide no-pad">
                              <span className="txt-md">
                                <IndeterminateCheckbox
                                  className="space-right"
                                  // @ts-expect-error -- TSCONVERSION
                                  type="checkbox"
                                  checked={checkAllModified}
                                  name="allModified"
                                  onChange={() =>
                                    setCheckAllModified(!checkAllModified)
                                  }
                                  indeterminate={!checkAllModified}
                                />
                              </span>{' '}
                              name
                            </label>
                          </th>
                          <th className="text-right">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modifiedChanges.map(item => (
                          <tr key={item.path} className="table--no-outline-row">
                            <td>
                              <label className="no-pad wide">
                                <input
                                  disabled={!item.editable || checkAllModified}
                                  className="space-right"
                                  type="checkbox"
                                  {...(checkAllModified
                                    ? { checked: true }
                                    : {})}
                                  defaultChecked={item.staged}
                                  value={item.path}
                                  name="paths"
                                />{' '}
                                {statusNames?.[item.path] || 'n/a'}
                              </label>
                            </td>
                            <td className="text-right">
                              {item.editable && (
                                <Tooltip
                                  message={item.added ? 'Delete' : 'Rollback'}
                                >
                                  <button
                                    className="btn btn--micro space-right"
                                    onClick={e => {
                                      e.preventDefault();
                                      if (formRef.current) {
                                        const data = new FormData(
                                          formRef.current
                                        );
                                        data.append('changeType', 'modified');
                                        data.delete('paths');
                                        data.append('paths', item.path);

                                        rollbackFetcher.submit(data, {
                                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/rollback`,
                                          method: 'post',
                                        });
                                      }
                                    }}
                                  >
                                    <i
                                      className={classnames(
                                        'fa',
                                        item.added ? 'fa-trash' : 'fa-undo'
                                      )}
                                    />
                                  </button>
                                </Tooltip>
                              )}
                              <OperationTooltip item={item} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {unversionedChanges.length > 0 && (
                  <div className="pad-top">
                    <strong>Unversioned Objects</strong>
                    <PromptButton
                      className="btn pull-right btn--micro"
                      onClick={e => {
                        e.preventDefault();
                        if (formRef.current) {
                          const data = new FormData(formRef.current);
                          data.append('changeType', 'unversioned');

                          rollbackFetcher.submit(data, {
                            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/rollback`,
                            method: 'post',
                          });
                        }
                      }}
                    >
                      Delete All
                    </PromptButton>
                    <table className="table--fancy table--outlined margin-top-sm">
                      <thead>
                        <tr className="table--no-outline-row">
                          <th>
                            <label className="wide no-pad">
                              <span className="txt-md">
                                <IndeterminateCheckbox
                                  className="space-right"
                                  // @ts-expect-error -- TSCONVERSION
                                  type="checkbox"
                                  name="allUnversioned"
                                  checked={checkAllUnversioned}
                                  onChange={() =>
                                    setCheckAllUnversioned(!checkAllUnversioned)
                                  }
                                  indeterminate={!checkAllUnversioned}
                                />
                              </span>{' '}
                              name
                            </label>
                          </th>
                          <th className="text-right">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unversionedChanges.map(item => (
                          <tr key={item.path} className="table--no-outline-row">
                            <td>
                              <label className="no-pad wide">
                                <input
                                  disabled={
                                    !item.editable || checkAllUnversioned
                                  }
                                  className="space-right"
                                  type="checkbox"
                                  value={item.path}
                                  name="paths"
                                  {...(checkAllUnversioned
                                    ? { checked: true }
                                    : {})}
                                  defaultChecked={item.staged}
                                />{' '}
                                {statusNames?.[item.path] || 'n/a'}
                              </label>
                            </td>
                            <td className="text-right">
                              {item.editable && (
                                <Tooltip
                                  message={item.added ? 'Delete' : 'Rollback'}
                                >
                                  <button
                                    className="btn btn--micro space-right"
                                    onClick={e => {
                                      e.preventDefault();
                                      if (formRef.current) {
                                        const data = new FormData(
                                          formRef.current
                                        );
                                        data.append(
                                          'changeType',
                                          'unversioned'
                                        );
                                        data.delete('paths');
                                        data.append('paths', item.path);

                                        rollbackFetcher.submit(data, {
                                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/rollback`,
                                          method: 'post',
                                        });
                                      }
                                    }}
                                  >
                                    <i
                                      className={classnames(
                                        'fa',
                                        item.added ? 'fa-trash' : 'fa-undo'
                                      )}
                                    />
                                  </button>
                                </Tooltip>
                              )}
                              <OperationTooltip item={item} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="txt-sm faint italic">
                {isLoadingGitChanges ? <>
                  <i className="fa fa-spinner fa-spin space-right" />
                  Loading changes...</> : 'No changes to commit.'}
              </div>
            )}
          </gitCommitFetcher.Form>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm">
            <i className="fa fa-code-fork" /> {branch}{' '}
          </div>
          <div>
            <button className="btn" onClick={() => modalRef.current?.hide()}>
              Close
            </button>
            <button
              type="submit"
              form="git-staging-form"
              className="btn"
              disabled={gitCommitFetcher.state !== 'idle' || !hasChanges}
            >
              <i className={`fa ${gitCommitFetcher.state === 'idle' ? 'fa-check' : 'fa-spinner fa-spin'} space-right`} />
              Commit
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
};

GitStagingModal.displayName = 'GitStagingModal';

const OperationTooltip = ({ item }: { item: Item }) => {
  const type =
    item.type === models.workspace.type ? strings.document.singular : item.type;
  if (item.status.includes('added')) {
    return (
      <Tooltip message="Added">
        <i className="fa fa-plus-circle success" /> {type}
      </Tooltip>
    );
  }
  if (item.status.includes('modified')) {
    return (
      <Tooltip message="Modified">
        <i className="fa fa-plus-circle faded" /> {type}
      </Tooltip>
    );
  }
  if (item.status.includes('deleted')) {
    return (
      <Tooltip message="Deleted">
        <i className="fa fa-minus-circle danger" /> {type}
      </Tooltip>
    );
  }
  return (
    <Tooltip message="Unknown">
      <i className="fa fa-question-circle info" /> {type}
    </Tooltip>
  );
};
