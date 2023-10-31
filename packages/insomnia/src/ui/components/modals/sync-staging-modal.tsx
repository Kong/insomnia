import React, { useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useParams } from 'react-router-dom';

import type { Status, StatusCandidate } from '../../../sync/types';
import { VCS } from '../../../sync/vcs/vcs';
import { IndeterminateCheckbox } from '../base/indeterminate-checkbox';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

type Props = ModalProps & {
  vcs: VCS;
  branch: string;
  status: Status;
  syncItems: StatusCandidate[];
};

export const SyncStagingModal = ({ branch, onHide, status, syncItems }: Props) => {
  const { projectId, workspaceId, organizationId } = useParams() as {
    projectId: string;
    workspaceId: string;
    organizationId: string;
  };

  const modalRef = useRef<ModalHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    modalRef.current?.show();
  }, []);
  const [checkAllModified, setCheckAllModified] = useState(false);
  const [checkAllUnversioned, setCheckAllUnversioned] = useState(false);

  const stagedChanges = Object.entries(status.stage);
  const unstagedChanges = Object.entries(status.unstaged);

  const allChanges = [...stagedChanges, ...unstagedChanges].map(([key, entry]) => ({
    ...entry,
    document: syncItems.find(item => item.key === key)?.document,
  }));

  const unversionedChanges = allChanges.filter(change => 'added' in change);
  const modifiedChanges = allChanges.filter(change => !('added' in change));

  const { Form } = useFetcher();

  return (
    <OverlayContainer>
      <Modal ref={modalRef} onHide={onHide}>
        <Form method='POST' ref={formRef}>
          <ModalHeader>Create Snapshot</ModalHeader>
          <ModalBody className="wide pad">
          <div className="form-group">
            <div className="form-control form-control--outlined">
              <label>
                Snapshot Message
                <textarea
                  cols={30}
                  rows={3}
                  name="message"
                  placeholder="This is a helpful message that describe the changes made in this snapshot"
                  required
                />
              </label>
            </div>
          </div>
            {modifiedChanges.length > 0 && (
              <div className="pad-top">
                <strong>Modified Objects</strong>
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
                      <tr key={item.key} className="table--no-outline-row">
                        <td>
                          <label className="no-pad wide">
                            <input
                              disabled={checkAllModified}
                              className="space-right"
                              type="checkbox"
                              {...(checkAllModified
                                ? { checked: true }
                                : {})}
                              value={item.key}
                              name="keys"
                            />{' '}
                            {item.name || 'n/a'}
                          </label>
                        </td>
                        <td className="text-right">
                          {/* <Tooltip
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
                          </Tooltip> */}
                          {/* <OperationTooltip item={item} /> */}
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
                              checked={checkAllUnversioned}
                              name="allModified"
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
                      <tr key={item.key} className="table--no-outline-row">
                        <td>
                          <label className="no-pad wide">
                            <input
                              disabled={checkAllUnversioned}
                              className="space-right"
                              type="checkbox"
                              {...(checkAllModified
                                ? { checked: true }
                                : {})}
                              value={item.key}
                              name="keys"
                            />{' '}
                            {item.name || 'n/a'}
                          </label>
                        </td>
                        <td className="text-right">
                          {item.document?.type}
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
              <i className="fa fa-code-fork" /> {branch}
            </div>
            <div>
              <button
                className="btn"
                type='submit'
                formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/create-snapshot`}
              >
                Create
              </button>
              <button
                className="btn"
                type='submit'
                formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/create-snapshot-and-push`}
              >
                Create and Push
              </button>
            </div>
          </ModalFooter>
        </Form>
      </Modal>
    </OverlayContainer>
  );
};
