// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import DebouncedInput from '../base/debounced-input';
import FileInputButton from '../base/file-input-button';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import HelpTooltip from '../help-tooltip';
import PromptButton from '../base/prompt-button';
import * as models from '../../../models/index';
import MarkdownEditor from '../markdown-editor';
import type { Workspace } from '../../../models/workspace';
import type { ClientCertificate } from '../../../models/client-certificate';

type Props = {
  clientCertificates: Array<ClientCertificate>,
  workspace: Workspace,
  editorFontSize: number,
  editorIndentSize: number,
  editorKeyMap: string,
  editorLineWrapping: boolean,
  nunjucksPowerUserMode: boolean,
  isVariableUncovered: boolean,
  handleRender: Function,
  handleGetRenderContext: Function,
  handleRemoveWorkspace: Function,
  handleDuplicateWorkspace: Function,
};

type State = {
  showAddCertificateForm: boolean,
  host: string,
  crtPath: string,
  keyPath: string,
  pfxPath: string,
  isPrivate: boolean,
  passphrase: string,
  showDescription: boolean,
  defaultPreviewMode: boolean,
};

@autobind
class WorkspaceSettingsModal extends React.PureComponent<Props, State> {
  modal: Modal | null;

  constructor(props: Props) {
    super(props);

    this.state = {
      showAddCertificateForm: false,
      host: '',
      crtPath: '',
      keyPath: '',
      pfxPath: '',
      passphrase: '',
      isPrivate: false,
      showDescription: false,
      defaultPreviewMode: false,
    };
  }

  _workspaceUpdate(patch: Object) {
    models.workspace.update(this.props.workspace, patch);
  }

  _handleAddDescription() {
    this.setState({ showDescription: true });
  }

  _handleSetModalRef(n: ?Modal) {
    this.modal = n;
  }

  _handleRemoveWorkspace() {
    this.props.handleRemoveWorkspace();
    this.hide();
  }

  _handleDuplicateWorkspace() {
    this.props.handleDuplicateWorkspace(() => {
      this.hide();
    });
  }

  _handleToggleCertificateForm() {
    this.setState(state => ({
      showAddCertificateForm: !state.showAddCertificateForm,
      crtPath: '',
      keyPath: '',
      pfxPath: '',
      host: '',
      passphrase: '',
      isPrivate: false,
    }));
  }

  _handleRename(name: string) {
    this._workspaceUpdate({ name });
  }

  _handleDescriptionChange(description: string) {
    this._workspaceUpdate({ description });

    if (this.state.defaultPreviewMode !== false) {
      this.setState({ defaultPreviewMode: false });
    }
  }

  _handleCreateHostChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ host: e.currentTarget.value });
  }

  _handleCreatePfxChange(pfxPath: string) {
    this.setState({ pfxPath });
  }

  _handleCreateCrtChange(crtPath: string) {
    this.setState({ crtPath });
  }

  _handleCreateKeyChange(keyPath: string) {
    this.setState({ keyPath });
  }

  _handleCreatePassphraseChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ passphrase: e.currentTarget.value });
  }

  _handleCreateIsPrivateChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ isPrivate: e.currentTarget.checked });
  }

  async _handleCreateCertificate(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const { workspace } = this.props;
    const { pfxPath, crtPath, keyPath, host, passphrase, isPrivate } = this.state;

    const certificate = {
      host,
      isPrivate,
      parentId: workspace._id,
      passphrase: passphrase || null,
      disabled: false,
      cert: crtPath || null,
      key: keyPath || null,
      pfx: pfxPath || null,
    };

    await models.clientCertificate.create(certificate);
    this._handleToggleCertificateForm();
  }

  static async _handleDeleteCertificate(certificate: ClientCertificate) {
    await models.clientCertificate.remove(certificate);
  }

  static async _handleToggleCertificate(certificate: ClientCertificate) {
    await models.clientCertificate.update(certificate, {
      disabled: !certificate.disabled,
    });
  }

  show() {
    const hasDescription = !!this.props.workspace.description;
    this.setState({
      showDescription: hasDescription,
      defaultPreviewMode: hasDescription,
      showAddCertificateForm: false,
    });

    this.modal && this.modal.show();
  }

  hide() {
    this.modal && this.modal.hide();
  }

  renderModalHeader() {
    const { workspace } = this.props;
    return (
      <ModalHeader key={`header::${workspace._id}`}>
        Workspace Settings{' '}
        <div className="txt-sm selectable faint monospace">{workspace ? workspace._id : ''}</div>
      </ModalHeader>
    );
  }

  renderCertificate(certificate: ClientCertificate) {
    return (
      <div key={certificate._id}>
        <div className="row-spaced">
          <div>
            <span className="pad-right no-wrap">
              <strong>PFX:</strong>{' '}
              {certificate.pfx ? <i className="fa fa-check" /> : <i className="fa fa-remove" />}
            </span>
            <span className="pad-right no-wrap">
              <strong>CRT:</strong>{' '}
              {certificate.cert ? <i className="fa fa-check" /> : <i className="fa fa-remove" />}
            </span>
            <span className="pad-right no-wrap">
              <strong>Key:</strong>{' '}
              {certificate.key ? <i className="fa fa-check" /> : <i className="fa fa-remove" />}
            </span>
            <span className="pad-right no-wrap" title={certificate.passphrase || null}>
              <strong>Passphrase:</strong>{' '}
              {certificate.passphrase ? (
                <i className="fa fa-check" />
              ) : (
                <i className="fa fa-remove" />
              )}
            </span>
            <span className="pad-right">
              <strong>Host:</strong>{' '}
              <span className="monospace selectable">{certificate.host}</span>
            </span>
          </div>
          <div className="no-wrap">
            <button
              className="btn btn--super-compact width-auto"
              title="Enable or disable certificate"
              onClick={() => WorkspaceSettingsModal._handleToggleCertificate(certificate)}>
              {certificate.disabled ? (
                <i className="fa fa-square-o" />
              ) : (
                <i className="fa fa-check-square-o" />
              )}
            </button>
            <PromptButton
              className="btn btn--super-compact width-auto"
              confirmMessage=" "
              addIcon
              onClick={() => WorkspaceSettingsModal._handleDeleteCertificate(certificate)}>
              <i className="fa fa-trash-o" />
            </PromptButton>
          </div>
        </div>
      </div>
    );
  }

  renderModalBody() {
    const {
      clientCertificates,
      workspace,
      editorLineWrapping,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
    } = this.props;

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
    } = this.state;

    return (
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
                <DebouncedInput
                  type="text"
                  delay={500}
                  placeholder="Awesome API"
                  defaultValue={workspace.name}
                  onChange={this._handleRename}
                />
              </label>
            </div>
            <div>
              {showDescription ? (
                <MarkdownEditor
                  className="margin-top"
                  defaultPreviewMode={defaultPreviewMode}
                  fontSize={editorFontSize}
                  indentSize={editorIndentSize}
                  keyMap={editorKeyMap}
                  placeholder="Write a description"
                  lineWrapping={editorLineWrapping}
                  handleRender={handleRender}
                  handleGetRenderContext={handleGetRenderContext}
                  nunjucksPowerUserMode={nunjucksPowerUserMode}
                  isVariableUncovered={isVariableUncovered}
                  defaultValue={workspace.description}
                  onChange={this._handleDescriptionChange}
                />
              ) : (
                <button
                  onClick={this._handleAddDescription}
                  className="btn btn--outlined btn--super-duper-compact">
                  Add Description
                </button>
              )}
            </div>
            <h2>Workspace Actions</h2>
            <div className="form-control form-control--padded">
              <PromptButton
                onClick={this._handleRemoveWorkspace}
                addIcon
                className="width-auto btn btn--clicky inline-block">
                <i className="fa fa-trash-o" /> Delete
              </PromptButton>
              <button
                onClick={this._handleDuplicateWorkspace}
                className="width-auto btn btn--clicky inline-block space-left">
                <i className="fa fa-copy" /> Duplicate
              </button>
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
                  ? publicCertificates.map(this.renderCertificate)
                  : null}

                {privateCertificates.length > 0 ? (
                  <div>
                    <h2>
                      Private Certificates
                      <HelpTooltip position="right" className="space-left">
                        Private certificates will not by synced.
                      </HelpTooltip>
                    </h2>
                    {privateCertificates.map(this.renderCertificate)}
                  </div>
                ) : null}
                <hr className="hr--spaced" />
                <div className="text-center">
                  <button
                    className="btn btn--clicky auto"
                    onClick={this._handleToggleCertificateForm}>
                    New Certificate
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={this._handleCreateCertificate}>
                <div className="form-control form-control--outlined no-pad-top">
                  <label>
                    Host
                    <HelpTooltip position="right" className="space-left">
                      The host for which this client certificate is valid. Port number is optional
                      and * can be used as a wildcard.
                    </HelpTooltip>
                    <input
                      type="text"
                      required="required"
                      placeholder="my-api.com"
                      autoFocus="autoFocus"
                      onChange={this._handleCreateHostChange}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <div className="form-control width-auto">
                    <label>
                      PFX <span className="faint">(or PKCS12)</span>
                      <FileInputButton
                        className="btn btn--clicky"
                        onChange={this._handleCreatePfxChange}
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
                          onChange={this._handleCreateCrtChange}
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
                          onChange={this._handleCreateKeyChange}
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
                      onChange={this._handleCreatePassphraseChange}
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
                      value={isPrivate}
                      onChange={this._handleCreateIsPrivateChange}
                    />
                  </label>
                </div>
                <br />
                <div className="pad-top text-right">
                  <button
                    type="button"
                    className="btn btn--super-compact space-right"
                    onClick={this._handleToggleCertificateForm}>
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
      </ModalBody>
    );
  }

  render() {
    const { workspace } = this.props;
    return (
      <Modal ref={this._handleSetModalRef} freshState>
        {workspace ? this.renderModalHeader() : null}
        {workspace ? this.renderModalBody() : null}
      </Modal>
    );
  }
}

export default WorkspaceSettingsModal;
