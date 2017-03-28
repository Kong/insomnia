import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import DebouncedInput from '../base/debounced-input';
import FileInputButton from '../base/file-input-button';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import PromptButton from '../base/prompt-button';
import * as models from '../../../models/index';
import {trackEvent} from '../../../analytics/index';

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
      passphrase: ''
    };
  }

  _workspaceUpdate (patch) {
    models.workspace.update(this.props.workspace, patch);
  }

  _handleSetModalRef (n) {
    this.modal = n;
  }
  _handleRemoveWorkspace () {
    this.props.handleRemoveWorkspace();
    this.hide();
  }

  _handleToggleCertificateForm () {
    this.setState({showAddCertificateForm: !this.state.showAddCertificateForm});
  }

  _handleRename (name) {
    this._workspaceUpdate({name});
  }
  _handleDescriptionChange (description) {
    this._workspaceUpdate({description});
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

  toggle (workspace) {
    this.modal.toggle();
    this.setState({
      workspace,
      showAddCertificateForm: false,
      crtPath: '',
      keyPath: '',
      pfxPath: '',
      host: '',
      passphrase: ''
    });
  }

  show () {
    this.modal.show();
    this.setState({
      showAddCertificateForm: false,
      crtPath: '',
      keyPath: '',
      pfxPath: '',
      host: '',
      passphrase: ''
    });
  }

  hide () {
    this.modal.hide();
  }

  renderModalHeader () {
    const {workspace} = this.props;
    return (
      <ModalHeader key={`header::${workspace._id}`}>
        Workspace Settings
      </ModalHeader>
    );
  }

  renderModalBody () {
    const {workspace} = this.props;
    const {pfxPath, crtPath, keyPath, showAddCertificateForm} = this.state;
    return (
      <ModalBody key={`body::${workspace._id}`} noScroll>
        <Tabs forceRenderTabPanel>
          <TabList>
            <Tab>
              <button>Overview</button>
            </Tab>
            <Tab>
              <button>Client Certificates</button>
            </Tab>
          </TabList>
          <TabPanel className="pad scrollable">
            <div className="row-fill">
              <div className="form-control form-control--outlined">
                <label>Workspace Name
                  <DebouncedInput
                    type="text"
                    delay={500}
                    placeholder="Awesome API"
                    defaultValue={workspace.name}
                    onChange={this._handleRename}
                  />
                </label>
              </div>
            </div>
            <div className="form-control form-control--outlined">
              <label>Description
                <DebouncedInput
                  textarea
                  delay={500}
                  rows="4"
                  placeholder="This workspace is for testing the Awesome API!"
                  defaultValue={workspace.description}
                  onChange={this._handleDescriptionChange}
                />
              </label>
            </div>
            <div className="form-control form-control--padded">
              <label htmlFor="nothing">Danger Zone
                <PromptButton onClick={this._handleRemoveWorkspace}
                              addIcon
                              className="width-auto btn btn--clicky">
                  <i className="fa fa-trash-o"/> Delete Workspace
                </PromptButton>
              </label>
            </div>
          </TabPanel>
          <TabPanel className="pad scrollable">
            {!showAddCertificateForm ? (
              <div>
                {workspace.certificates.length === 0 ? (
                  <p className="notice info margin-top-sm">
                    You have not yet added any certificates
                  </p>
                ) : workspace.certificates.map(certificate => (
                  <div key={certificate.host} className="row-spaced">
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
                        <i className="fa fa-trash-o"></i>
                      </PromptButton>
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
                  <label>Host <span className="faint">(port optional)</span>
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
      <Modal ref={this._handleSetModalRef} tall freshState>
        {workspace ? this.renderModalHeader() : null}
        {workspace ? this.renderModalBody() : null}
      </Modal>
    );
  }
}

WorkspaceSettingsModal.propTypes = {
  handleRemoveWorkspace: PropTypes.func.isRequired,
  workspace: PropTypes.object.isRequired
};

export default WorkspaceSettingsModal;
