import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import DebouncedInput from '../base/debounced-input';
import FileInputButton from '../base/file-input-button';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import HelpTooltip from '../help-tooltip';
import PromptButton from '../base/prompt-button';
import * as models from '../../../models/index';
import {trackEvent} from '../../../analytics/index';
import MarkdownEditor from '../markdown-editor';

@autobind
class WorkspaceSettingsModal extends PureComponent {
  constructor (props) {
    super(props);

    this.state = {
      showAddCertificateForm: false,
      crtPath: '',
      keyPath: '',
      pfxPath: '',
      host: '',
      passphrase: '',
      showDescription: false,
      defaultPreviewMode: false
    };
  }

  _workspaceUpdate (patch) {
    models.workspace.update(this.props.workspace, patch);
  }

  _handleAddDescription () {
    this.setState({showDescription: true});
    trackEvent('Workspace', 'Add Description');
  }

  _handleSetModalRef (n) {
    this.modal = n;
  }

  _handleRemoveWorkspace () {
    this.props.handleRemoveWorkspace();
    this.hide();
  }

  _handleDuplicateWorkspace () {
    this.props.handleDuplicateWorkspace(() => {
      this.hide();
    });
  }

  _handleToggleCertificateForm () {
    this.setState({showAddCertificateForm: !this.state.showAddCertificateForm});
  }

  _handleRename (name) {
    this._workspaceUpdate({name});
  }

  _handleDescriptionChange (description) {
    this._workspaceUpdate({description});

    if (this.state.defaultPreviewMode !== false) {
      this.setState({defaultPreviewMode: false});
    }
  }

  _handleCreateHostChange (e) {
    this.setState({host: e.target.value});
  }

  _handleCreatePfxChange (pfxPath) {
    this.setState({pfxPath});
  }

  _handleCreateCrtChange (crtPath) {
    this.setState({crtPath});
  }

  _handleCreateKeyChange (keyPath) {
    this.setState({keyPath});
  }

  _handleCreatePassphraseChange (e) {
    this.setState({passphrase: e.target.value});
  }

  async _handleSubmitCertificate (e) {
    e.preventDefault();

    const {workspace} = this.props;
    const {pfxPath, crtPath, keyPath, host, passphrase} = this.state;

    const certificate = {
      host,
      passphrase,
      cert: crtPath,
      key: keyPath,
      pfx: pfxPath,
      disabled: false
    };

    const certificates = [
      ...workspace.certificates.filter(c => c.host !== certificate.host),
      certificate
    ];

    await models.workspace.update(workspace, {certificates});
    this._handleToggleCertificateForm();
    trackEvent('Certificates', 'Create');
  }

  _handleDeleteCertificate (certificate) {
    const {workspace} = this.props;
    const certificates = workspace.certificates.filter(c => c.host !== certificate.host);
    models.workspace.update(workspace, {certificates});
    trackEvent('Certificates', 'Delete');
  }

  _handleToggleCertificate (certificate) {
    const {workspace} = this.props;
    const certificates = workspace.certificates.map(
      c => c === certificate ? Object.assign({}, c, {disabled: !c.disabled}) : c
    );
    models.workspace.update(workspace, {certificates});
    trackEvent('Certificates', 'Toggle');
  }

  show () {
    const hasDescription = !!this.props.workspace.description;
    this.setState({
      showAddCertificateForm: false,
      crtPath: '',
      keyPath: '',
      pfxPath: '',
      host: '',
      passphrase: '',
      showDescription: hasDescription,
      defaultPreviewMode: hasDescription
    });
    this.modal.show();
  }

  hide () {
    this.modal.hide();
  }

  renderModalHeader () {
    const {workspace} = this.props;
    return (
      <ModalHeader key={`header::${workspace._id}`}>
        Workspace Settings
        {' '}
        <div className="txt-sm selectable faint monospace">
          {workspace ? workspace._id : ''}
        </div>
      </ModalHeader>
    );
  }

  renderModalBody () {
    const {
      workspace,
      editorLineWrapping,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      handleRender,
      handleGetRenderContext
    } = this.props;

    const {
      pfxPath,
      crtPath,
      keyPath,
      showAddCertificateForm,
      showDescription,
      defaultPreviewMode
    } = this.state;

    return (
      <ModalBody key={`body::${workspace._id}`} noScroll>
        <Tabs forceRenderTabPanel className="react-tabs">
          <TabList>
            <Tab>
              <button>Overview</button>
            </Tab>
            <Tab>
              <button>Client Certificates</button>
            </Tab>
          </TabList>
          <TabPanel className="react-tabs__tab-panel pad scrollable pad-top-sm">
            <div className="form-control form-control--outlined">
              <label>Name
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
                  defaultValue={workspace.description}
                  onChange={this._handleDescriptionChange}
                />
              ) : (
                <button onClick={this._handleAddDescription}
                        className="btn btn--outlined btn--super-duper-compact">
                  Add Description
                </button>
              )}
            </div>
            <h2>Workspace Actions</h2>
            <div className="form-control form-control--padded">
              <PromptButton onClick={this._handleRemoveWorkspace}
                            addIcon
                            className="width-auto btn btn--clicky inline-block">
                <i className="fa fa-trash-o"/> Delete
              </PromptButton>
              <button onClick={this._handleDuplicateWorkspace}
                      className="width-auto btn btn--clicky inline-block space-left">
                <i className="fa fa-copy"/> Duplicate
              </button>
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel pad scrollable">
            {!showAddCertificateForm ? (
              <div>
                {workspace.certificates.length === 0 ? (
                  <p className="notice info margin-top-sm">
                    You have not yet added any certificates
                  </p>
                ) : workspace.certificates.map(certificate => (
                  <div key={certificate.host}>
                    <p className="notice info no-margin-top">
                      Client certificates are an experimental feature
                    </p>
                    <div className="row-spaced">
                      <div>
                      <span className="pad-right no-wrap">
                        <strong>PFX:</strong>
                        {' '}
                        {certificate.pfx
                          ? <i className="fa fa-check"/>
                          : <i className="fa fa-remove"/>
                        }
                      </span>
                        <span className="pad-right no-wrap">
                        <strong>CRT:</strong>
                          {' '}
                          {certificate.cert
                            ? <i className="fa fa-check"/>
                            : <i className="fa fa-remove"/>
                          }
                      </span>
                        <span className="pad-right no-wrap">
                        <strong>Key:</strong>
                          {' '}
                          {certificate.key
                            ? <i className="fa fa-check"/>
                            : <i className="fa fa-remove"/>
                          }
                      </span>
                        <span className="pad-right no-wrap" title={certificate.passphrase || null}>
                        <strong>Passphrase:</strong>
                          {' '}
                          {certificate.passphrase
                            ? <i className="fa fa-check"/>
                            : <i className="fa fa-remove"/>
                          }
                      </span>
                        <span className="pad-right">
                        <strong>Host:</strong>
                          {' '}
                          <span className="monospace selectable">{certificate.host}</span>
                      </span>
                      </div>
                      <div className="no-wrap">
                        <button className="btn btn--super-compact width-auto"
                                title="Enable or disable certificate"
                                onClick={() => this._handleToggleCertificate(certificate)}>
                          {certificate.disabled
                            ? <i className="fa fa-square-o"/>
                            : <i className="fa fa-check-square-o"/>
                          }
                        </button>
                        <PromptButton className="btn btn--super-compact width-auto"
                                      confirmMessage=" "
                                      addIcon
                                      onClick={() => this._handleDeleteCertificate(certificate)}>
                          <i className="fa fa-trash-o"/>
                        </PromptButton>
                      </div>
                    </div>
                  </div>
                ))}
                <hr className="hr--spaced"/>
                <div className="text-center">
                  <button className="btn btn--clicky auto"
                          onClick={this._handleToggleCertificateForm}>
                    Add Certificate
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={this._handleSubmitCertificate}>
                <div className="form-control form-control--outlined no-pad-top">
                  <label>Host
                    <HelpTooltip position="right" className="space-left">
                      The host for which this client certificate is valid.
                      Port number is optional and * can be used as a wildcard.
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
                    <label>PFX <span className="faint">(or PKCS12)</span>
                      <FileInputButton
                        className="btn btn--clicky"
                        onChange={this._handleCreatePfxChange}
                        path={pfxPath}
                        showFileName
                      />
                    </label>
                  </div>
                  <div className="text-center">
                    <br/><br/>
                    &nbsp;&nbsp;Or&nbsp;&nbsp;
                  </div>
                  <div className="row-fill">
                    <div className="form-control">
                      <label>CRT File
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
                      <label>Key File
                        <FileInputButton
                          className="btn btn--clicky"
                          name="Key"
                          onChange={this._handleCreateKeyChange}
                          path={keyPath}
                          showFileName/>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="form-control form-control--outlined">
                  <label>Passphrase
                    <input
                      type="password"
                      placeholder="•••••••••••"
                      onChange={this._handleCreatePassphraseChange}
                    />
                  </label>
                </div>
                <br/>
                <div className="pad-top text-right">
                  <button type="button"
                          className="btn btn--super-compact"
                          onClick={this._handleToggleCertificateForm}>
                    Cancel
                  </button>
                  {' '}
                  <button className="btn btn--clicky" type="submit">
                    Add Certificate
                  </button>
                </div>
              </form>
            )}
          </TabPanel>
        </Tabs>
      </ModalBody>
    );
  }

  render () {
    const {workspace} = this.props;
    return (
      <Modal ref={this._handleSetModalRef} freshState>
        {workspace ? this.renderModalHeader() : null}
        {workspace ? this.renderModalBody() : null}
      </Modal>
    );
  }
}

WorkspaceSettingsModal.propTypes = {
  workspace: PropTypes.object.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorIndentSize: PropTypes.number.isRequired,
  editorKeyMap: PropTypes.string.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  handleRemoveWorkspace: PropTypes.func.isRequired,
  handleDuplicateWorkspace: PropTypes.func.isRequired
};

export default WorkspaceSettingsModal;
