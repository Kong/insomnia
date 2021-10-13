// @flow
import * as React from 'react';
import urlJoin from 'url-join';
import autobind from 'autobind-decorator';
import { Button } from 'insomnia-components';

type Props = {
  axios: (
    config: Object,
  ) => Promise<{
    statusText: string,
    data: Object,
    status: number,
  }>,
  trackEvent: (category: string, action: string, label: ?string, value: ?string) => any,
  store: {
    hasItem: (key: string) => Promise<boolean>,
    setItem: (key: string, value: string) => Promise<void>,
    getItem: (key: string) => Promise<string | null>,
  },
  spec: {
    contents: Object,
    rawContents: string,
    format: string,
    formatVersion: string,
  },
};

type AxiosError = Object;

type State = {|
  workspaceId: string,
  kongPortalRbacToken: string,
  kongPortalApiUrl: string,
  kongPortalUrl: string,
  kongPortalUserWorkspace: string,
  isLoading: boolean,
  connectionError: AxiosError | Error | null,
  showUploadError: boolean,
  forceSpecOverwrite: boolean,
  kongSpecFileName: string,
  kongPortalLegacyMode: boolean,
  kongPortalDeployView: 'edit' | 'upload' | 'error' | 'overwrite' | 'success',
  kongPortalDeployError: string,
|};

const STATE_KEYS_TO_PERSIST = [
  'kongPortalRbacToken',
  'kongPortalApiUrl',
  'kongPortalUrl',
  'kongPortalUserWorkspace',
];

@autobind
class DeployToPortal extends React.Component<Props, State> {
  state = {
    workspaceId: '',
    kongPortalRbacToken: '',
    kongPortalApiUrl: '',
    kongPortalUrl: '',
    kongPortalUserWorkspace: '',
    kongSpecFileName: '',
    isLoading: false,
    connectionError: null,
    showUploadError: false,
    kongPortalLegacyMode: false,
    kongPortalDeployView: 'edit',
    forceSpecOverwrite: false,
    kongPortalDeployError: '',
  };

  _handleLoadingToggle(status: boolean) {
    this.setState({ isLoading: status });
  }

  _hasConnectInfo() {
    return this.state.kongPortalApiUrl.length > 0 && this.state.kongPortalUserWorkspace.length > 0;
  }

  _handleEditKongConnection() {
    this.setState({ kongPortalDeployView: 'edit' });
  }

  _handleReturnToUpload() {
    this.setState({ kongPortalDeployView: 'upload' });
  }

  async _handleUploadSpec(overwrite: boolean, e?: SyntheticEvent<HTMLFormElement>) {
    if (e) {
      e.preventDefault();
    }

    const { spec, axios, trackEvent } = this.props;

    const {
      kongSpecFileName,
      kongPortalUserWorkspace,
      kongPortalApiUrl,
      kongPortalRbacToken,
      kongPortalLegacyMode,
    } = this.state;

    let newSpec;
    let method = 'post';
    let urlFilePath = urlJoin(kongPortalApiUrl, kongPortalUserWorkspace + '/files');
    let headers = {};

    // Check legacy mode
    if (kongPortalLegacyMode) {
      newSpec = {
        type: 'spec',
        name: kongSpecFileName,
        contents: spec.rawContents,
      };
    } else {
      newSpec = {
        path: urlJoin('specs/', kongSpecFileName),
        contents: spec.rawContents,
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
      urlFilePath = urlJoin(
        kongPortalApiUrl,
        kongPortalUserWorkspace,
        '/files/specs/',
        kongSpecFileName,
      );
    }

    try {
      const response = await axios({
        method: method,
        url: urlFilePath,
        data: newSpec,
        headers: headers,
      });
      if (response.statusText === 'Created' || response.statusText === 'OK') {
        this.setState({ kongPortalDeployView: 'success' });
        trackEvent('Portal', 'Upload', overwrite ? 'Replace' : 'Create');
      }
    } catch (err) {
      if (err.response && err.response.status === 409) {
        this.setState({ kongPortalDeployView: 'overwrite' });
        trackEvent('Portal', 'Upload Error', overwrite ? 'Replace' : 'Create');
      } else {
        console.log('Failed to upload to dev portal', err.response);
        if (err.response && err.response.data && err.response.data.message) {
          this.setState({ kongPortalDeployError: err.response.data.message });
        }
        this.setState({ kongPortalDeployView: 'error' });
      }
    }
  }

  async _handleConnectKong(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const { axios, trackEvent } = this.props;

    const { kongPortalUserWorkspace, kongPortalApiUrl, kongPortalRbacToken } = this.state;

    // Show loading animation
    this._handleLoadingToggle(true);
    try {
      // Check connection
      const apiUrl = urlJoin(kongPortalApiUrl, kongPortalUserWorkspace + '/kong');

      const response = await axios({
        method: 'get',
        url: apiUrl,
        headers: {
          'Kong-Admin-Token': kongPortalRbacToken,
        },
      });
      if (response.status === 200 || response.status === 201) {
        trackEvent('Portal', 'Connection');
        // Set legacy mode for post upload formatting, suppress loader, set monitor portal URL, move to upload view
        const guiHost = response.data.configuration.portal_gui_host;
        this.setState({
          kongPortalLegacyMode: response.data.configuration.portal_is_legacy,
          connectionError: null,
          kongPortalDeployView: 'upload',
          kongPortalUrl: urlJoin(`http://${guiHost}`, kongPortalUserWorkspace),
        });

        this._handleLoadingToggle(false);
      }
    } catch (error) {
      trackEvent('Portal', 'Connection Error');
      console.log('Connection error', error);
      this._handleLoadingToggle(false);
      this.setState({ connectionError: error });
    }
  }

  async componentDidMount() {
    const newState = {};
    for (const key of STATE_KEYS_TO_PERSIST) {
      const value = await this.props.store.getItem(key);

      // Extra check to make Flow happy
      if (typeof value === 'string') {
        newState[key] = value;
      }
    }

    this.setState(newState);
  }

  async componentDidUpdate() {
    for (const key of STATE_KEYS_TO_PERSIST) {
      await this.props.store.setItem(key, this.state[key]);
    }
  }

  async _handleKongPortalApiUrlChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ kongPortalApiUrl: e.currentTarget.value });
  }

  async _handleRBACKTokenChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ kongPortalRbacToken: e.currentTarget.value });
  }

  async _handleKongPortalUserWorkspaceChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ kongPortalUserWorkspace: e.currentTarget.value });
  }

  render() {
    const {
      kongPortalApiUrl,
      kongSpecFileName,
      kongPortalUserWorkspace,
      kongPortalDeployView,
      connectionError,
      kongPortalRbacToken,
      isLoading,
      showUploadError,
      kongPortalLegacyMode,
      kongPortalUrl,
      kongPortalDeployError,
    } = this.state;

    // Check input > enable connection & upload
    const connectIsEnabled = kongPortalApiUrl.length > 0 && kongPortalUserWorkspace.length > 0;
    const uploadIsEnabled = kongSpecFileName.length > 0;

    // Check view
    if (kongPortalDeployView === 'edit') {
      let connectionErrorElement = null;

      if (connectionError) {
        const stack = connectionError.stack;
        let messageToShow = stack;
        if (connectionError?.isAxiosError && connectionError.response) {
          const response: Object = connectionError.response;
          messageToShow = `${response.status} ${response.statusText}`;
          const responseMessage = response.data?.message;
          if (responseMessage) {
            messageToShow += `: ${responseMessage}`;
          }
        }

        connectionErrorElement = (
          <p className="notice error margin-top-sm text-left">
            Error. Please check your settings and try again.
            <details className="margin-top-sm">
              <summary>More details</summary>
              <pre className="pad-top-sm selectable">
                <code className="wide overflow-auto">{messageToShow}</code>
              </pre>
            </details>
          </p>
        );
      }
      return (
        // Kong Connection Details
        <form className="pad" onSubmit={this._handleConnectKong}>
          {connectionErrorElement}
          <div className="form-control form-control--outlined">
            <label>
              Kong API URL
              <input
                type="url"
                placeholder="Eg. https://kong-api.domain.com"
                defaultValue={kongPortalApiUrl}
                onChange={this._handleKongPortalApiUrlChange}
              />
            </label>
            <br />
            <label>
              Kong Workspace Name
              <input
                type="text"
                placeholder="Eg. my-workspace-name"
                defaultValue={kongPortalUserWorkspace}
                onChange={this._handleKongPortalUserWorkspaceChange}
              />
            </label>
            <br />
            <label>
              Kong RBAC Token
              <input
                type="password"
                placeholder="Optional"
                defaultValue={kongPortalRbacToken}
                onChange={this._handleRBACKTokenChange}
              />
            </label>
          </div>
          <div className="row margin-top">
            <Button
              bg="surprise"
              type="submit"
              disabled={!connectIsEnabled}
              className="margin-right-sm">
              {isLoading ? 'Connecting...' : 'Connect to Kong'}
            </Button>
            <Button data-close-modal="true" type="button">
              Cancel
            </Button>
          </div>
        </form>
      );
    } else if (kongPortalDeployView === 'upload') {
      return (
        // File Name > Upload
        <form className="pad" onSubmit={this._handleUploadSpec.bind(this, false)}>
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
            <p className="notice error margin-top-sm">The file already exists on this workspace.</p>
          )}
          <div className="form-control form-control--outlined margin-top">
            <label>
              File Name
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
          <div className="row margin-top">
            <Button
              bg="surprise"
              type="submit"
              className="margin-right-sm"
              disabled={!uploadIsEnabled}>
              {isLoading ? 'Uploading...' : 'Upload To Dev Portal'}
            </Button>
            <Button onClick={this._handleEditKongConnection} type="button">
              Go Back
            </Button>
          </div>
        </form>
      );
    } else if (kongPortalDeployView === 'success') {
      return (
        <div className="pad">
          <p className="no-pad no-margin-top">
            The Document is now available on
            {kongPortalLegacyMode ? 'Dev Portal' : <a href={kongPortalUrl}>Dev Portal</a>}
          </p>
          <div>
            <Button data-close-modal="true">Close</Button>
          </div>
        </div>
      );
    } else if (kongPortalDeployView === 'error') {
      return (
        // File Name > Upload
        <div className="pad">
          <p className="notice error no-margin-top">
            Error uploading spec <strong>{kongSpecFileName}</strong> to the{' '}
            <strong>{kongPortalUserWorkspace}</strong> workspace.{' '}
            <strong>{kongPortalDeployError}</strong>
          </p>
          <div className="row margin-top">
            <Button
              bg="surprise"
              onClick={() => this._handleUploadSpec(false)}
              className="margin-right-sm"
              disabled={!uploadIsEnabled}>
              Try Again
            </Button>
            <button onClick={this._handleReturnToUpload}>Go Back</button>
          </div>
        </div>
      );
    } else if (kongPortalDeployView === 'overwrite') {
      return (
        // File Name > Upload
        <div className="pad">
          <p className="notice error no-margin-top">File already exists in workspace.</p>
          <p className="no-pad no-margin-top">
            Uploading spec <strong>{kongSpecFileName}</strong> to the{' '}
            <strong>{kongPortalUserWorkspace}</strong> workspace will overwrite the existing spec.
          </p>
          <div className="row margin-top">
            <Button
              bg="surprise"
              onClick={() => this._handleUploadSpec(true)}
              className="margin-right-sm"
              disabled={!uploadIsEnabled}>
              Overwrite Existing Spec
            </Button>
            <Button onClick={this._handleReturnToUpload}>Go Back</Button>
          </div>
        </div>
      );
    } else {
      return <p>Nothing to see here...</p>;
    }
  }
}

export default DeployToPortal;
