// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import axios from 'axios';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import DebouncedInput from '../base/debounced-input';
import * as models from '../../../models';
import type { Workspace } from '../../../models/workspace';
import type { ApiSpec } from '../../../models/api-spec';
import type { WorkspaceMeta } from '../../../models/workspace-meta';
import type { GlobalActivity } from '../../components/activity-bar/activity-bar';
import ModalFooter from '../base/modal-footer';
import urljoin from 'url-join';
import HelpLink from '../help-link';

type Props = {|
  workspace: Workspace,
  apiSpec: ApiSpec,
  workspaceMeta: WorkspaceMeta,
  handleSetActivity: (activity: GlobalActivity) => void,
|};

type State = {
  kongPortalRbacToken: string,
  kongPortalApiUrl: string,
  kongPortalUrl: string,
  kongPortalUserWorkspace: string,
  isLoading: boolean,
  showConnectionError: boolean,
  showUploadError: boolean,
  forceSpecOverwrite: boolean,
  kongSpecFileName: string,
  kongPortalLegacyMode: boolean,
  kongConnectionDetails: boolean,
  kongPortalDeployView: string,
};

@autobind
class PortalUploadModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  onUpload: null | (() => void);

  constructor(props: Props) {
    super(props);
    this.onUpload = null;
    this.state = {
      kongPortalRbacToken: props.workspaceMeta.kongPortalRbacToken,
      kongPortalApiUrl: props.workspaceMeta.kongPortalApiUrl,
      kongPortalUrl: props.workspaceMeta.kongPortalUrl,
      kongPortalUserWorkspace: props.workspaceMeta.kongPortalUserWorkspace,
      kongSpecFileName: '',
      isLoading: false,
      showConnectionError: false,
      showUploadError: false,
      kongPortalLegacyMode: false,
      kongConnectionDetails: false,
      kongPortalDeployView: 'edit',
      forceSpecOverwrite: false,
    };
  }

  _workspaceUpdate(patch: Object) {
    models.workspace.update(this.props.workspace, patch);
  }

  _handleLoadingToggle(status: boolean) {
    this.setState({ isLoading: status });
  }

  _hasKongConnectionInfo() {
    this.setState({
      kongConnectionDetails:
        this.state.kongPortalRbacToken.length > 0 &&
        this.state.kongPortalApiUrl.length > 0 &&
        this.state.kongPortalUserWorkspace.length > 0,
    });
  }

  _handleEditKongConnection() {
    this.setState({ kongPortalDeployView: 'edit' });
  }

  _handleReturnToUpload() {
    this.setState({ kongPortalDeployView: 'upload' });
  }

  _handleCloseConnectKong() {
    this.setState({ kongPortalDeployView: 'upload' });
    this.modal && this.modal.hide();
  }

  _handleCloseSuccess() {
    this.modal && this.modal.hide();
    this.setState({ kongPortalDeployView: 'upload' });
  }

  _handleShowDeveloperPortal() {
    this.setState({ kongPortalDeployView: 'upload' });
    this.modal && this.modal.hide();
    const { handleSetActivity } = this.props;
    handleSetActivity('monitor');
  }

  async _handleUploadSpec(overwrite: boolean) {
    const {
      kongSpecFileName,
      kongPortalUserWorkspace,
      kongPortalApiUrl,
      kongPortalRbacToken,
      kongPortalLegacyMode,
    } = this.state;
    const { apiSpec } = this.props;
    let activeSpec = apiSpec;
    let newSpec;
    let method = 'post';
    let urlFilePath = urljoin(kongPortalApiUrl, kongPortalUserWorkspace + '/files');
    let headers = {};

    // Check legacy mode
    if (kongPortalLegacyMode) {
      newSpec = {
        type: 'spec',
        name: kongSpecFileName,
        contents: activeSpec.contents,
      };
    } else {
      newSpec = {
        path: 'specs/' + kongSpecFileName,
        contents: activeSpec.contents,
      };
    }
    // Check RBAC
    if (kongPortalRbacToken.length > 0) {
      headers = {
        'Content-Type': 'application/json',
        'Kong-Admin-Token': kongPortalRbacToken,
      };
    }
    // Check overwrite intent
    if (overwrite) {
      method = 'patch';
      urlFilePath = urljoin(
        kongPortalApiUrl,
        kongPortalUserWorkspace + '/files/specs/' + kongSpecFileName,
      );
    }
    try {
      let response = await axios({
        method: method,
        url: urlFilePath,
        data: newSpec,
        adapter: global.require('axios/lib/adapters/http'),
        headers: headers,
      });
      if (response.statusText === 'Created' || response.statusText === 'OK') {
        this.setState({ kongPortalDeployView: 'success' });
      }
    } catch (err) {
      this.setState({ kongPortalDeployView: 'overwrite' });
    }
  }

  async _handleConnectKong() {
    // Show loading animation
    this._handleLoadingToggle(true);
    try {
      // Check connection
      const apiUrl = urljoin(
        this.state.kongPortalApiUrl,
        this.state.kongPortalUserWorkspace + '/kong',
      );

      const response = await axios.get(apiUrl, {
        adapter: global.require('axios/lib/adapters/http'),
        headers: {
          'Kong-Admin-Token': this.state.kongPortalRbacToken,
        },
      });
      if (response.status === 200 || response.status === 201) {
        // Set legacy mode for post upload formatting, suppress loader, set monitor portal URL, move to upload view
        const workspaceMeta = this.props.workspaceMeta;
        models.workspaceMeta.update(workspaceMeta, {
          kongPortalUrl:
            'http://' +
            response.data.configuration.portal_gui_host +
            '/' +
            this.state.kongPortalUserWorkspace,
        });

        this.setState({
          kongPortalLegacyMode: response.data.configuration.portal_is_legacy,
          kongConnectionDetails: true,
          showConnectionError: false,
          kongPortalDeployView: 'upload',
        });

        this._handleLoadingToggle(false);
      }
    } catch (error) {
      this._handleLoadingToggle(false);
      this.setState({ showConnectionError: true });
    }
  }

  async _handleKongPortalApiUrlChange(url: string) {
    this.setState({ kongPortalApiUrl: url });
    const workspaceMeta = this.props.workspaceMeta;
    models.workspaceMeta.update(workspaceMeta, { kongPortalApiUrl: url });
  }

  _handleRBACKTokenChange(token: string) {
    this.setState({ kongPortalRbacToken: token });
    const workspaceMeta = this.props.workspaceMeta;
    models.workspaceMeta.update(workspaceMeta, { kongPortalRbacToken: token });
  }

  _handleKongPortalUserWorkspaceChange(name: string) {
    this.setState({ kongPortalUserWorkspace: name });
    const workspaceMeta = this.props.workspaceMeta;
    models.workspaceMeta.update(workspaceMeta, { kongPortalUserWorkspace: name });
  }

  _setModalRef(ref: ?Modal) {
    this.modal = ref;
  }

  async show(options: { onUpload?: () => void }) {
    this.modal && this.modal.show();
  }

  render() {
    const {
      kongPortalApiUrl,
      kongSpecFileName,
      kongPortalUserWorkspace,
      kongPortalDeployView,
      showConnectionError,
      kongPortalRbacToken,
      isLoading,
      showUploadError,
      kongPortalLegacyMode,
      kongPortalUrl,
    } = this.state;

    // Check input > enable connection & upload
    let connectIsEnabled = kongPortalApiUrl.length > 0 && kongPortalUserWorkspace.length > 0;
    let uploadIsEnabled = kongSpecFileName.length > 0;

    const helpLink = <HelpLink slug="deploy-to-dev-portal" />;

    // Check view
    if (kongPortalDeployView === 'edit') {
      return (
        // Kong Connection Details
        <Modal ref={this._setModalRef} className="modal--skinny">
          <ModalHeader>Upload Spec to Kong Portal {helpLink}</ModalHeader>
          <ModalBody className="pad">
            {showConnectionError && (
              <p className="notice error margin-top-sm">
                Error. Please check your settings and try again.
              </p>
            )}
            <p className="no-pad no-margin-top">Let's connect Kong Studio to the Kong API:</p>
            <div className="form-control form-control--outlined">
              <label>
                Kong API URL
                <DebouncedInput
                  type="url"
                  delay={300}
                  placeholder="Eg. https://kong-api.domain.com"
                  defaultValue={kongPortalApiUrl}
                  onChange={this._handleKongPortalApiUrlChange}
                />
              </label>
              <br />
              <label>
                Kong Workspace Name
                <DebouncedInput
                  type="text"
                  delay={300}
                  placeholder="Eg. my-workspace-name"
                  defaultValue={kongPortalUserWorkspace}
                  onChange={this._handleKongPortalUserWorkspaceChange}
                />
              </label>
              <br />
              <label>
                Kong RBAC Token
                <DebouncedInput
                  type="password"
                  delay={300}
                  placeholder="Optional"
                  defaultValue={kongPortalRbacToken}
                  onChange={this._handleRBACKTokenChange}
                />
              </label>
            </div>
          </ModalBody>
          <ModalFooter>
            <div>
              <button
                className="btn studio-action-btn"
                onClick={this._handleConnectKong}
                disabled={!connectIsEnabled}>
                <div className="with-icon">
                  {isLoading && (
                    <svg
                      className="status-loading"
                      version="1.1"
                      id="L9"
                      x="0px"
                      y="0px"
                      viewBox="0 0 100 100"
                      enableBackground="new 0 0 0 0">
                      <path
                        fill="#000"
                        d="M73,50c0-12.7-10.3-23-23-23S27,37.3,27,50 M30.9,50c0-10.5,8.5-19.1,19.1-19.1S69.1,39.5,69.1,50">
                        <animateTransform
                          attributeName="transform"
                          attributeType="XML"
                          type="rotate"
                          dur=".8"
                          from="0 50 50"
                          to="360 50 50"
                          repeatCount="indefinite"
                        />
                      </path>
                    </svg>
                  )}
                  <div>Connect to Kong</div>
                </div>
              </button>
              <button className="btn" onClick={this._handleCloseConnectKong}>
                Cancel
              </button>
            </div>
          </ModalFooter>
        </Modal>
      );
    } else if (kongPortalDeployView === 'upload') {
      return (
        // File Name > Upload
        <Modal ref={this._setModalRef} className="modal--skinny">
          <ModalHeader>Upload Spec to Kong Portal {helpLink}</ModalHeader>
          <ModalBody className="pad">
            <p
              className="pad margin-top-sm"
              style={{
                backgroundColor: '#EDF8F1',
                color: '#2A6F47',
                borderColor: '#B5E3C8',
                border: '1px solid green',
                textAlign: 'left',
              }}>
              <i className="fa fa-check" /> Connected to Kong
              <a
                className="success pull-right faint underline pointer"
                onClick={this._handleEditKongConnection}>
                Edit Connection
              </a>
            </p>
            {showUploadError && (
              <p className="notice error margin-top-sm">
                The file already exists on this workspace.
              </p>
            )}
            <div className="form-control form-control--outlined margin-top">
              <label>
                Specify a File Name
                <input
                  type="text"
                  placeholder="Eg. unique-file-name.yaml"
                  defaultValue=""
                  onChange={evt => {
                    this.setState({ kongSpecFileName: evt.target.value });
                  }}
                />
              </label>
            </div>
          </ModalBody>
          <ModalFooter>
            <div>
              <button
                className="btn studio-action-btn"
                onClick={() => this._handleUploadSpec(false)}
                disabled={!uploadIsEnabled}>
                <div className="with-icon">
                  {isLoading && (
                    <svg
                      className="status-loading"
                      version="1.1"
                      id="L9"
                      x="0px"
                      y="0px"
                      viewBox="0 0 100 100"
                      enableBackground="new 0 0 0 0">
                      <path
                        fill="#000"
                        d="M73,50c0-12.7-10.3-23-23-23S27,37.3,27,50 M30.9,50c0-10.5,8.5-19.1,19.1-19.1S69.1,39.5,69.1,50">
                        <animateTransform
                          attributeName="transform"
                          attributeType="XML"
                          type="rotate"
                          dur=".8"
                          from="0 50 50"
                          to="360 50 50"
                          repeatCount="indefinite"
                        />
                      </path>
                    </svg>
                  )}
                  <div>Upload To Kong Portal</div>
                </div>
              </button>
              <button className="btn" onClick={this._handleReturnToUpload}>
                Go Back
              </button>
            </div>
          </ModalFooter>
        </Modal>
      );
    } else if (kongPortalDeployView === 'success') {
      return (
        <Modal ref={this._setModalRef} className="modal--skinny">
          <ModalHeader>Success, Spec Uploaded!</ModalHeader>
          <ModalBody className="pad">
            <p className="no-pad no-margin-top">
              The latest changes are now available in the Developer Portal.
              {kongPortalLegacyMode === false && (
                <span>
                  Would you like to{' '}
                  <a href={kongPortalUrl}>
                    <strong>view the developer portal?</strong>
                  </a>
                </span>
              )}
            </p>
          </ModalBody>
          <ModalFooter>
            <div>
              <button className="btn" onClick={this._handleCloseConnectKong}>
                Close
              </button>
            </div>
          </ModalFooter>
        </Modal>
      );
    } else if (kongPortalDeployView === 'overwrite') {
      return (
        // File Name > Upload
        <Modal ref={this._setModalRef} className="modal--skinny">
          <ModalHeader>Upload Spec to Kong Portal {helpLink}</ModalHeader>
          <ModalBody className="pad">
            <p className="no-pad no-margin-top">File already exists in workspace.</p>
            <p className="no-pad no-margin-top">
              Uploading spec <strong>{kongSpecFileName}</strong> to the{' '}
              <strong>{kongPortalUserWorkspace}</strong> workspace will overwrite the existing spec.
            </p>
          </ModalBody>
          <ModalFooter>
            <div>
              <button
                className="btn studio-action-btn"
                onClick={() => this._handleUploadSpec(true)}
                disabled={!uploadIsEnabled}>
                <div className="with-icon">
                  {isLoading && (
                    <svg
                      className="status-loading"
                      version="1.1"
                      id="L9"
                      x="0px"
                      y="0px"
                      viewBox="0 0 100 100"
                      enableBackground="new 0 0 0 0">
                      <path
                        fill="#000"
                        d="M73,50c0-12.7-10.3-23-23-23S27,37.3,27,50 M30.9,50c0-10.5,8.5-19.1,19.1-19.1S69.1,39.5,69.1,50">
                        <animateTransform
                          attributeName="transform"
                          attributeType="XML"
                          type="rotate"
                          dur=".8"
                          from="0 50 50"
                          to="360 50 50"
                          repeatCount="indefinite"
                        />
                      </path>
                    </svg>
                  )}
                  <div>Overwrite Existing Spec</div>
                </div>
              </button>
              <button className="btn" onClick={this._handleReturnToUpload}>
                Go Back
              </button>
            </div>
          </ModalFooter>
        </Modal>
      );
    } else {
      return <p>Nothing to see here...</p>;
    }
  }
}

export default PortalUploadModal;
