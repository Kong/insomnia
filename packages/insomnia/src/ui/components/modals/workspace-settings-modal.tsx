import React, { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { CaCertificate } from '../../../models/ca-certificate';
import type { ClientCertificate } from '../../../models/client-certificate';
import * as models from '../../../models/index';
import { isRequest } from '../../../models/request';
import { isScratchpad, Workspace } from '../../../models/workspace';
import { WorkspaceMeta } from '../../../models/workspace-meta';
import { FileInputButton } from '../base/file-input-button';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { HelpTooltip } from '../help-tooltip';
import { MarkdownEditor } from '../markdown-editor';
import { PasswordViewer } from '../viewers/password-viewer';

const CertificateFields = styled.div({
  display: 'flex',
  flexDirection: 'column',
  margin: 'var(--padding-sm) 0',
});

const CertificateField: FC<{
  title: string;
  value: string | null;
  privateText?: boolean;
  optional?: boolean;
}> = ({
  title,
  value,
  privateText,
  optional,
}) => {
  if (optional && value === null) {
    return null;
  }

  let display: ReactNode = value;
  if (privateText) {
    display = <PasswordViewer text={value} />;
  } else {
    display = <span className="monospace selectable">{value}</span>;
  }

    return (
      <span className="pad-right no-wrap">
        <strong>{title}:</strong>{' '}{display}
      </span>
    );
  };

interface WorkspaceSettingsModalState {
  showAddCertificateForm: boolean;
  host: string;
  crtPath: string;
  keyPath: string;
  pfxPath: string;
  isPrivate: boolean;
  passphrase: string;
  showDescription: boolean;
  defaultPreviewMode: boolean;
}
interface Props extends ModalProps {
  workspace: Workspace;
  workspaceMeta: WorkspaceMeta;
  clientCertificates: ClientCertificate[];
  caCertificate: CaCertificate | null;
}

export const WorkspaceSettingsModal = ({ workspace, clientCertificates, caCertificate, onHide }: Props) => {
  const hasDescription = !!workspace.description;
  const isScratchpadWorkspace = isScratchpad(workspace);
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<WorkspaceSettingsModalState>({
    showAddCertificateForm: false,
    host: '',
    crtPath: '',
    keyPath: '',
    pfxPath: '',
    passphrase: '',
    isPrivate: false,
    showDescription: hasDescription,
    defaultPreviewMode: hasDescription,
  });
  const activeWorkspaceName = workspace.name;
  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const { organizationId, projectId } = useParams<{ organizationId: string; projectId: string }>();
  const workspaceFetcher = useFetcher();
  const workspacePatcher = (workspaceId: string, patch: Partial<Workspace>) => {
    workspaceFetcher.submit({ ...patch, workspaceId }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/update`,
      method: 'post',
      encType: 'application/json',
    });
  };

  const _handleClearAllResponses = async () => {
    if (!workspace) {
      return;
    }
    const docs = await db.withDescendants(workspace, models.request.type);
    const requests = docs.filter(isRequest);
    for (const req of requests) {
      await models.response.removeForRequest(req._id);
    }
    modalRef.current?.hide();
  };

  const _handleToggleCertificateForm = () => {
    setState({
      ...state,
      showAddCertificateForm: !state.showAddCertificateForm,
      crtPath: '',
      keyPath: '',
      pfxPath: '',
      host: '',
      passphrase: '',
      isPrivate: false,
    });
  };
  const _handleCreateCertificate = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { pfxPath, crtPath, keyPath, host, passphrase, isPrivate } = state;

    newClientCert({
      host,
      isPrivate,
      parentId: workspace._id,
      passphrase: passphrase || null,
      disabled: false,
      cert: crtPath || null,
      key: keyPath || null,
      pfx: pfxPath || null,
    });
    _handleToggleCertificateForm();
  };
  const _handleRemoveWorkspace = async () => {
    const workspaceId = workspace._id;
    workspaceFetcher.submit({ workspaceId }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/delete`,
      method: 'post',
    });
  };

  const renderCertificate = (certificate: ClientCertificate) => {
    return (
      <div className="row-spaced" key={certificate._id}>
        <CertificateFields>
          <CertificateField title="Host" value={certificate.host} />
          {certificate.pfx ? (
            <CertificateField title="PFX" value={certificate.pfx} />
          ) : (
            <CertificateField title="CRT" value={certificate.cert} />
          )}
          <CertificateField title="Key" value={certificate.key} optional />
          <CertificateField title="Passphrase" value={certificate.passphrase} privateText optional />
        </CertificateFields>

        <div className="no-wrap">
          <button
            className="btn btn--super-compact width-auto"
            title="Enable or disable certificate"
            onClick={() => toggleClientCert(certificate)}
          >
            {certificate.disabled ? (
              <i className="fa fa-square-o" />
            ) : (
              <i className="fa fa-check-square-o" />
            )}
          </button>
          <PromptButton
            className="btn btn--super-compact width-auto"
            confirmMessage=""
            onClick={() => deleteClientCert(certificate)}
          >
            <i className="fa fa-trash-o" />
          </PromptButton>
        </div>
      </div>
    );
  };
  const sharedCertificates = clientCertificates.filter(c => !c.isPrivate);
  const privateCertificates = clientCertificates.filter(c => c.isPrivate);
  const {
    pfxPath,
    crtPath,
    keyPath,
    isPrivate,
    showAddCertificateForm,
    showDescription,
    defaultPreviewMode,
  } = state;

  const newCaCert = (path: string) => {
    workspaceFetcher.submit({ parentId: workspace._id, path }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/cacert/new`,
      method: 'post',
      encType: 'application/json',
    });
  };
  const deleteCaCert = () => {
    workspaceFetcher.submit({}, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/cacert/delete`,
      method: 'post',
      encType: 'application/json',
    });
  };
  const toggleCaCert = (caCert: CaCertificate) => {
    workspaceFetcher.submit({ _id: caCert._id, disabled: !caCert.disabled }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/cacert/update`,
      method: 'post',
      encType: 'application/json',
    });
  };
  const newClientCert = (certificate: Partial<ClientCertificate>) => {
    workspaceFetcher.submit(certificate, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/clientcert/new`,
      method: 'post',
      encType: 'application/json',
    });
  };
  const deleteClientCert = (certificate: ClientCertificate) => {
    workspaceFetcher.submit({ _id: certificate._id }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/clientcert/delete`,
      method: 'post',
      encType: 'application/json',
    });
  };
  const toggleClientCert = (certificate: ClientCertificate) => {
    workspaceFetcher.submit({ _id: certificate._id, disabled: !certificate.disabled }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/clientcert/update`,
      method: 'post',
      encType: 'application/json',
    });
  };

  return (
    <OverlayContainer>
      <Modal ref={modalRef} onHide={onHide}>
        {workspace ?
          <ModalHeader key={`header::${workspace._id}`}>
            {getWorkspaceLabel(workspace).singular} Settings{' '}
            <div className="txt-sm selectable faint monospace">{workspace ? workspace._id : ''}</div>
          </ModalHeader> : null}
        {workspace ?
          <ModalBody key={`body::${workspace._id}`} noScroll>
            <Tabs
              items={[{
                title: 'Overview',
                children: <PanelContainer className="pad pad-top-sm">
                  <div className="form-control form-control--outlined">
                    <label>
                      Name
                      <input
                        type="text"
                        readOnly={isScratchpadWorkspace}
                        placeholder="Awesome API"
                        defaultValue={activeWorkspaceName}
                        onChange={event => workspacePatcher(workspace._id, { name: event.target.value })}
                      />
                    </label>
                  </div>
                  <div>
                    {showDescription ? (
                      <MarkdownEditor
                        className="margin-top"
                        defaultPreviewMode={defaultPreviewMode}
                        placeholder="Write a description"
                        defaultValue={workspace.description}
                        onChange={(description: string) => {
                          workspacePatcher(workspace._id, { description });
                          if (state.defaultPreviewMode !== false) {
                            setState(state => ({
                              ...state,
                              defaultPreviewMode: false,
                            }));
                          }
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setState({ ...state, showDescription: true });
                        }}
                        className="btn btn--outlined btn--super-duper-compact"
                      >
                        Add Description
                      </button>
                    )}
                  </div>
                  <h2>Actions</h2>
                  <div className="form-control form-control--padded">
                    {!isScratchpadWorkspace && (
                      <PromptButton
                        onClick={_handleRemoveWorkspace}
                        className="width-auto btn btn--clicky inline-block"
                      >
                        <i className="fa fa-trash-o" /> Delete
                      </PromptButton>
                    )}
                    <PromptButton
                      onClick={_handleClearAllResponses}
                      className="width-auto btn btn--clicky inline-block space-left"
                    >
                      <i className="fa fa-trash-o" /> Clear All Responses
                    </PromptButton>
                  </div>
                </PanelContainer>,
              }, {
                  title: 'Client Certificates',
                  children: <PanelContainer className="pad">
                    <div className="form-control form-control--outlined">
                      <label>
                        CA Certificate
                        <HelpTooltip position="right" className="space-left">
                          One or more PEM format certificates to trust when making requests.
                        </HelpTooltip>
                      </label>
                      <div className="row-spaced">
                        <FileInputButton
                          disabled={caCertificate !== null}
                          className="btn btn--clicky"
                          name="PEM file"
                          onChange={newCaCert}
                          path={caCertificate?.path || ''}
                          showFileName
                          showFileIcon
                        />
                        <div className="no-wrap">
                          <button
                            disabled={caCertificate === null}
                            className="btn btn--super-compact width-auto"
                            title="Enable or disable certificate"
                            onClick={() => caCertificate && toggleCaCert(caCertificate)}
                          >
                            {caCertificate?.disabled !== false ? (
                              <i className="fa fa-square-o" />
                            ) : (
                              <i className="fa fa-check-square-o" />
                            )}
                          </button>
                          <PromptButton
                            disabled={caCertificate === null}
                            className="btn btn--super-compact width-auto"
                            confirmMessage=""
                            doneMessage=""
                            onClick={deleteCaCert}
                          >
                            <i className="fa fa-trash-o" />
                          </PromptButton>
                        </div>
                      </div>
                    </div>
                    {!showAddCertificateForm ? (
                      <div>
                        {clientCertificates.length === 0 ? (
                          <p className="notice surprise margin-top">
                            You have not yet added any client certificates
                          </p>
                        ) : null}

                        {!!sharedCertificates.length && (
                          <div className="form-control form-control--outlined margin-top">
                            <label>
                              Shared Certificates
                              <HelpTooltip position="right" className="space-left">
                                Shared certificates will be synced.
                              </HelpTooltip>
                            </label>
                            {sharedCertificates.map(renderCertificate)}
                          </div>
                        )}

                        {!!privateCertificates.length && (
                          <div className="form-control form-control--outlined margin-top">
                            <label>
                              Private Certificates
                              <HelpTooltip position="right" className="space-left">
                                Certificates will not be Git Synced.
                              </HelpTooltip>
                            </label>
                            {privateCertificates.map(renderCertificate)}
                          </div>
                        )}
                        <hr className="hr--spaced" />
                        <div className="text-center">
                          <button
                            className="btn btn--clicky auto"
                            onClick={_handleToggleCertificateForm}
                          >
                            New Certificate
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={_handleCreateCertificate}>
                        <div className="form-control form-control--outlined no-pad-top">
                          <label>
                            Host
                            <HelpTooltip position="right" className="space-left">
                              The host for which this client certificate is valid. Port number is optional
                              and * can be used as a wildcard.
                            </HelpTooltip>
                            <input
                              type="text"
                              required
                              placeholder="my-api.com"
                              autoFocus
                              onChange={event => setState({ ...state, host: event.currentTarget.value })}
                            />
                          </label>
                        </div>
                        <div className="form-row">
                          <div className="form-control width-auto">
                            <label>
                              PFX <span className="faint">(or PKCS12)</span>
                              <FileInputButton
                                className="btn btn--clicky"
                                onChange={pfxPath => setState({ ...state, pfxPath })}
                                path={pfxPath}
                                showFileName
                              />
                            </label>
                          </div>
                          <div className="text-center">
                            <br />
                            <br />
                            &nbsp;&nbsp;Or&nbsp;&nbsp;
                          </div>
                          <div className="row-fill">
                            <div className="form-control">
                              <label>
                                CRT File
                                <FileInputButton
                                  className="btn btn--clicky"
                                  name="Cert"
                                  onChange={crtPath => setState({ ...state, crtPath })}
                                  path={crtPath}
                                  showFileName
                                />
                              </label>
                            </div>
                            <div className="form-control">
                              <label>
                                Key File
                                <FileInputButton
                                  className="btn btn--clicky"
                                  name="Key"
                                  onChange={keyPath => setState({ ...state, keyPath })}
                                  path={keyPath}
                                  showFileName
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="form-control form-control--outlined">
                          <label>
                            Passphrase
                            <input
                              type="password"
                              placeholder="•••••••••••"
                              onChange={event => setState({ ...state, passphrase: event.target.value })}
                            />
                          </label>
                        </div>
                        <div className="form-control form-control--slim">
                          <label>
                            Private
                            <HelpTooltip className="space-left">
                              Certificates will not be Git Synced
                            </HelpTooltip>
                            <input
                              type="checkbox"
                              // @ts-expect-error -- TSCONVERSION boolean not valid
                              value={isPrivate}
                              onChange={event => setState({ ...state, isPrivate: event.target.checked })}
                            />
                          </label>
                        </div>
                        <br />
                        <div className="pad-top text-right">
                          <button
                            type="button"
                            className="btn btn--super-compact space-right"
                            onClick={_handleToggleCertificateForm}
                          >
                            Cancel
                          </button>
                          <button className="btn btn--clicky space-right" type="submit">
                            Create Certificate
                          </button>
                        </div>
                      </form>
                    )}
                  </PanelContainer>,
                }]}
              aria-label="Workspace settings tabs"
            >
              {props => (
                <TabItem key={props.title?.toString()} {...props} />
              )}
            </Tabs>
          </ModalBody> : null}
      </Modal>
    </OverlayContainer>
  );
};
WorkspaceSettingsModal.displayName = 'WorkspaceSettingsModal';
