import { AxiosError, AxiosRequestConfig } from 'axios';
import type ReactLib from 'react';
import { type SyntheticEvent } from 'react';
import urlJoin from 'url-join';

import { Context, Spec } from './document-actions';

const isAxiosError = (error?: Error | AxiosError): error is AxiosError =>
  Boolean(error) && Object.prototype.hasOwnProperty.call(error, 'isAxiosError');

interface Props {
  axios: (config: AxiosRequestConfig) => Promise<{
    statusText: string;
    data: {
      configuration: {
        portal_gui_host: string;
        portal_is_legacy: boolean;
      };
    };
    status: number;
  }>;
  trackSegmentEvent: Context['__private']['analytics']['trackSegmentEvent'];
  store: Context['store'];
  spec: Spec;
}

interface PersistedState {
  kongPortalRbacToken: string;
  kongPortalApiUrl: string;
  kongPortalUrl: string;
  kongPortalUserWorkspace: string;
}

interface State extends PersistedState {
  workspaceId: string;

  isLoading: boolean;
  connectionError: AxiosError | Error | null;
  showUploadError: boolean;
  forceSpecOverwrite: boolean;
  kongSpecFileName: string;
  kongPortalLegacyMode: boolean;
  kongPortalDeployView: 'edit' | 'upload' | 'error' | 'overwrite' | 'success';
  kongPortalDeployError: string;
}

const defaultPersistedState: PersistedState = {
  kongPortalRbacToken: '',
  kongPortalApiUrl: '',
  kongPortalUrl: '',
  kongPortalUserWorkspace: '',
};

export function getDeployToPortalComponent(options: {
  React: typeof ReactLib;
}): { DeployToPortal: ReactLib.ComponentType<Props> } {
  const { React } = options;
  class DeployToPortal extends React.Component<Props, State> {
    state: State = {
      ...defaultPersistedState,
      workspaceId: '',
      kongSpecFileName: '',
      isLoading: false,
      connectionError: null,
      showUploadError: false,
      kongPortalLegacyMode: false,
      kongPortalDeployView: 'edit',
      forceSpecOverwrite: false,
      kongPortalDeployError: '',
    };

    _handleLoadingToggle = (status: boolean) => {
      this.setState({ isLoading: status });
    };

    _hasConnectInfo = () => {
      return (
        this.state.kongPortalApiUrl.length > 0 &&
        this.state.kongPortalUserWorkspace.length > 0
      );
    };

    _handleEditKongConnection = () => {
      this.setState({ kongPortalDeployView: 'edit' });
    };

    _handleReturnToUpload = () => {
      this.setState({ kongPortalDeployView: 'upload' });
    };

    _handleUploadSpec = async (
      overwrite: boolean,
      event?: SyntheticEvent<HTMLFormElement>
    ) => {
      if (event) {
        event.preventDefault();
      }

      const { spec, axios, trackSegmentEvent } = this.props;

      const {
        kongSpecFileName,
        kongPortalUserWorkspace,
        kongPortalApiUrl,
        kongPortalRbacToken,
        kongPortalLegacyMode,
      } = this.state;

      let newSpec;
      let method: AxiosRequestConfig['method'] = 'post';
      let urlFilePath = urlJoin(
        kongPortalApiUrl,
        kongPortalUserWorkspace + '/files'
      );
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
          kongSpecFileName
        );
      }

      try {
        const response = await axios({
          method,
          url: urlFilePath,
          data: newSpec,
          headers,
        });
        if (response.statusText === 'Created' || response.statusText === 'OK') {
          this.setState({ kongPortalDeployView: 'success' });
          const action = overwrite ? 'replace_portal' : 'create_portal';
          trackSegmentEvent('Kong Synced', { type: 'deploy', action });
        }
      } catch (err) {
        if (err.response && err.response.status === 409) {
          this.setState({ kongPortalDeployView: 'overwrite' });
          const action = overwrite ? 'replace_portal' : 'create_portal';
          trackSegmentEvent('Kong Synced', {
            type: 'deploy',
            action,
            error: err.response.status + ': ' + err.response.statusText,
          });
        } else {
          console.log('Failed to upload to dev portal', err.response);
          if (err.response && err.response.data && err.response.data.message) {
            this.setState({ kongPortalDeployError: err.response.data.message });
          }
          this.setState({ kongPortalDeployView: 'error' });
        }
      }
    };

    _handleConnectKong = async (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();

      const { axios, trackSegmentEvent } = this.props;

      const { kongPortalUserWorkspace, kongPortalApiUrl, kongPortalRbacToken } =
        this.state;

      // Show loading animation
      this._handleLoadingToggle(true);
      try {
        // Check connection
        const apiUrl = urlJoin(
          kongPortalApiUrl,
          kongPortalUserWorkspace + '/kong'
        );

        const response = await axios({
          method: 'get',
          url: apiUrl,
          headers: {
            'Kong-Admin-Token': kongPortalRbacToken,
          },
        });
        if (response.status === 200 || response.status === 201) {
          trackSegmentEvent('Kong Connected', {
            type: 'token',
            action: 'portal_deploy',
          });

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
      } catch (error: unknown) {
        if (error instanceof Error) {
          trackSegmentEvent('Kong Connected', {
            type: 'token',
            action: 'portal_deploy',
            error: error.message,
          });
          console.log('Connection error', error);
          this._handleLoadingToggle(false);
          this.setState({ connectionError: error });
        }
      }
    };

    componentDidMount = async () => {
      const newState = { ...defaultPersistedState };
      for (const key in newState) {
        const value = await this.props.store.getItem(key);
        newState[key as keyof PersistedState] = String(value);
      }
      this.setState(newState);
    };

    componentDidUpdate = async () => {
      for (const key in defaultPersistedState) {
        await this.props.store.setItem(
          key,
          this.state[key as keyof PersistedState]
        );
      }
    };

    _handleKongPortalApiUrlChange = async (event: SyntheticEvent<HTMLInputElement>) => {
      this.setState({ kongPortalApiUrl: event.currentTarget.value });
    };

    _handleRBACKTokenChange = async (event: SyntheticEvent<HTMLInputElement>) => {
      this.setState({ kongPortalRbacToken: event.currentTarget.value });
    };

    _handleKongPortalUserWorkspaceChange = async (
      event: SyntheticEvent<HTMLInputElement>
    ) => {
      this.setState({ kongPortalUserWorkspace: event.currentTarget.value });
    };

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
      const connectIsEnabled =
        kongPortalApiUrl.length > 0 && kongPortalUserWorkspace.length > 0;
      const uploadIsEnabled = kongSpecFileName.length > 0;

      // Check view
      if (kongPortalDeployView === 'edit') {
        let connectionErrorElement: JSX.Element | null = null;

        if (connectionError) {
          const stack = connectionError.stack;
          let messageToShow = stack;
          if (isAxiosError(connectionError) && connectionError.response) {
            const response = connectionError.response;
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
              <button
                type="submit"
                disabled={!connectIsEnabled}
                style={{
                  marginRight: 'var(--padding-sm)',
                  color: 'var(--color-surprise)',
                }}
              >
                {isLoading ? 'Connecting...' : 'Connect to Kong'}
              </button>
              <button data-close-modal="true" type="button">
                Cancel
              </button>
            </div>
          </form>
        );
      } else if (kongPortalDeployView === 'upload') {
        return (
          // File Name > Upload
          <form
            className="pad"
            onSubmit={this._handleUploadSpec.bind(this, false)}
          >
            <p
              className="pad margin-top-sm"
              style={{
                backgroundColor: '#EDF8F1',
                color: '#2A6F47',
                borderColor: '#B5E3C8',
                border: '1px solid green',
                textAlign: 'left',
              }}
            >
              <i className="fa fa-check" /> Connected to Kong
              <a
                className="success pull-right faint underline pointer"
                onClick={this._handleEditKongConnection}
              >
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
              <button
                type="submit"
                style={{
                  marginRight: 'var(--padding-sm)',
                  color: 'var(--color-surprise)',
                }}
                disabled={!uploadIsEnabled}
              >
                {isLoading ? 'Uploading...' : 'Upload To Dev Portal'}
              </button>
              <button onClick={this._handleEditKongConnection} type="button">
                Go Back
              </button>
            </div>
          </form>
        );
      } else if (kongPortalDeployView === 'success') {
        return (
          <div className="pad">
            <p className="no-pad no-margin-top">
              The Document is now available on&nbsp;
              {kongPortalLegacyMode ? (
                'Dev Portal'
              ) : (
                <a href={kongPortalUrl}>Dev Portal</a>
              )}
            </p>
            <div>
              <button data-close-modal="true">Close</button>
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
              <button
                onClick={() => this._handleUploadSpec(false)}
                style={{
                  marginRight: 'var(--padding-sm)',
                  color: 'var(--color-surprise)',
                }}
                disabled={!uploadIsEnabled}
              >
                Try Again
              </button>
              <button onClick={this._handleReturnToUpload}>Go Back</button>
            </div>
          </div>
        );
      } else if (kongPortalDeployView === 'overwrite') {
        return (
          // File Name > Upload
          <div className="pad">
            <p className="notice error no-margin-top">
              File already exists in workspace.
            </p>
            <p className="no-pad no-margin-top">
              Uploading spec <strong>{kongSpecFileName}</strong> to the{' '}
              <strong>{kongPortalUserWorkspace}</strong> workspace will
              overwrite the existing spec.
            </p>
            <div className="row margin-top">
              <button
                onClick={() => this._handleUploadSpec(true)}
                style={{
                  marginRight: 'var(--padding-sm)',
                  color: 'var(--color-surprise)',
                }}
                disabled={!uploadIsEnabled}
              >
                Overwrite Existing Spec
              </button>
              <button onClick={this._handleReturnToUpload}>Go Back</button>
            </div>
          </div>
        );
      } else {
        return <p>Nothing to see here...</p>;
      }
    }
  }

  return { DeployToPortal };
}
