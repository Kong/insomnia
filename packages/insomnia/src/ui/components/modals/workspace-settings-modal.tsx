import React, { FC, forwardRef, ReactNode, useImperativeHandle, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { ACTIVITY_HOME } from '../../../common/constants';
import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import type { ClientCertificate } from '../../../models/client-certificate';
import * as workspaceOperations from '../../../models/helpers/workspace-operations';
import * as models from '../../../models/index';
import { isRequest } from '../../../models/request';
import { setActiveActivity } from '../../redux/modules/global';
import { selectActiveApiSpec, selectActiveWorkspace, selectActiveWorkspaceClientCertificates, selectActiveWorkspaceName } from '../../redux/selectors';
import { FileInputButton } from '../base/file-input-button';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';
import { MarkdownEditor } from '../markdown-editor';
import { PasswordViewer } from '../viewers/password-viewer';
import { showModal } from '.';
import { WorkspaceDuplicateModal } from './workspace-duplicate-modal';

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
export interface WorkspaceSettingsModalOptions {
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
export interface WorkspaceSettingsModalHandle {
  show: (options: WorkspaceSettingsModalOptions) => void;
  hide: () => void;
}
export const WorkspaceSettingsModal = forwardRef<WorkspaceSettingsModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<WorkspaceSettingsModalOptions>({
    showAddCertificateForm: false,
    host: '',
    crtPath: '',
    keyPath: '',
    pfxPath: '',
    passphrase: '',
    isPrivate: false,
    showDescription: false,
    defaultPreviewMode: false,
  });

  const workspace = useSelector(selectActiveWorkspace);
  const apiSpec = useSelector(selectActiveApiSpec);
  const activeWorkspaceName = useSelector(selectActiveWorkspaceName);
  const clientCertificates = useSelector(selectActiveWorkspaceClientCertificates);
  const dispatch = useDispatch();
  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: () => {
      const hasDescription = !!workspace?.description;
      setState(state => ({
        ...state,
        showDescription: hasDescription,
        defaultPreviewMode: hasDescription,
        showAddCertificateForm: false,
      }));
      modalRef.current?.show();
    },
  }), [workspace?.description]);

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
    const certificate = {
      host,
      isPrivate,
      parentId: workspace?._id,
      passphrase: passphrase || null,
      disabled: false,
      cert: crtPath || null,
      key: keyPath || null,
      pfx: pfxPath || null,
    };
    await models.clientCertificate.create(certificate);

    _handleToggleCertificateForm();
  };
  const _handleRemoveWorkspace = async () => {
    if (!workspace) {
      return;
    }
    await models.stats.incrementDeletedRequestsForDescendents(workspace);
    await models.workspace.remove(workspace);
    dispatch(setActiveActivity(ACTIVITY_HOME));
    modalRef.current?.hide();
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
            onClick={() => models.clientCertificate.update(certificate, {
              disabled: !certificate.disabled,
            })}
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
            onClick={() => models.clientCertificate.remove(certificate)}
          >
            <i className="fa fa-trash-o" />
          </PromptButton>
        </div>
      </div>
    );
  };
  const publicCertificates = clientCertificates.filter(c => !c.isPrivate);
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
  return (
    <Modal ref={modalRef}>
      {workspace ?
        <ModalHeader key={`header::${workspace._id}`}>
          {getWorkspaceLabel(workspace).singular} Settings{' '}
          <div className="txt-sm selectable faint monospace">{workspace ? workspace._id : ''}</div>
        </ModalHeader> : null}
      {workspace ?
        <ModalBody key={`body::${workspace._id}`} noScroll>
          <Tabs forceRenderTabPanel className="react-tabs">
            <TabList>
              <Tab tabIndex="-1">
                <button>Overview</button>
              </Tab>
              <Tab tabIndex="-1">
                <button>Client Certificates</button>
              </Tab>
            </TabList>
            <TabPanel className="react-tabs__tab-panel pad scrollable pad-top-sm">
              <div className="form-control form-control--outlined">
                <label>
                  Name
                  <input
                    type="text"
                    placeholder="Awesome API"
                    defaultValue={activeWorkspaceName}
                    onChange={event => workspaceOperations.rename(event.target.value, workspace, apiSpec)}
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
                      models.workspace.update(workspace, { description });
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
                <PromptButton
                  onClick={_handleRemoveWorkspace}
                  className="width-auto btn btn--clicky inline-block"
                >
                  <i className="fa fa-trash-o" /> Delete
                </PromptButton>
                <button
                  onClick={() => {
                    showModal(WorkspaceDuplicateModal, { workspace, apiSpec, onDone: modalRef.current?.hide });
                  }}
                  className="width-auto btn btn--clicky inline-block space-left"
                >
                  <i className="fa fa-copy" /> Duplicate
                </button>
                <PromptButton
                  onClick={_handleClearAllResponses}
                  className="width-auto btn btn--clicky inline-block space-left"
                >
                  <i className="fa fa-trash-o" /> Clear All Responses
                </PromptButton>
              </div>
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              {!showAddCertificateForm ? (
                <div>
                  {clientCertificates.length === 0 ? (
                    <p className="notice surprise margin-top-sm">
                      You have not yet added any certificates
                    </p>
                  ) : null}

                  {publicCertificates.length > 0
                    ? publicCertificates.map(renderCertificate)
                    : null}

                  {privateCertificates.length > 0 ? (
                    <div>
                      <h2>
                        Private Certificates
                        <HelpTooltip position="right" className="space-left">
                          Private certificates will not by synced.
                        </HelpTooltip>
                      </h2>
                      {privateCertificates.map(renderCertificate)}
                    </div>
                  ) : null}
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
                        Private certificates will not be synced
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
            </TabPanel>
          </Tabs>
        </ModalBody> : null}
    </Modal>
  );
});
WorkspaceSettingsModal.displayName = 'WorkspaceSettingsModal';
