import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { docsGitSync } from '../../../../common/documentation';
import type { GitRepository } from '../../../../models/git-repository';
import { deleteGitRepository } from '../../../../models/helpers/git-repository-operations';
import { isGitCredentialsOAuth } from '../../../../sync/git/git-vcs';
import { Link } from '../../base/link';
import { Modal } from '../../base/modal';
import { ModalBody } from '../../base/modal-body';
import { ModalFooter } from '../../base/modal-footer';
import { ModalHeader } from '../../base/modal-header';
import { ErrorBoundary } from '../../error-boundary';
import { HelpTooltip } from '../../help-tooltip';
import { CustomRepositorySettingsFormGroup } from './custom-repository-settings-form-group';
import { GitHubRepositorySetupFormGroup } from './github-repository-settings-form-group';

interface State {
  gitRepository: GitRepository | null;
  inputs: {
    uri?: string;
    authorName?: string;
    authorEmail?: string;
    username?: string;
    token?: string;
    oauth2format?: 'github';
  };
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class GitRepositorySettingsModal extends PureComponent<{}, State> {
  modal: Modal | null = null;
  input: HTMLInputElement | null = null;
  _onSubmitEdits?: ((arg0: GitRepository) => any) | null;

  state: State = {
    inputs: {},
    gitRepository: null,
  };

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  _setInputRef(n: HTMLInputElement) {
    this.input = n;
  }

  async _handleInputChange(e: React.SyntheticEvent<HTMLInputElement>) {
    const { name, value } = e.currentTarget;
    this.setState(state => ({
      inputs: { ...state.inputs, [name]: value },
    }));
  }

  async _handleReset() {
    const { gitRepository } = this.state;

    if (!gitRepository) {
      // Nothing to do
      return;
    }

    await deleteGitRepository(gitRepository);
    this.hide();
  }

  async _handleSubmitEdit(e: React.SyntheticEvent<HTMLButtonElement>) {
    e.preventDefault();
    const { inputs, gitRepository } = this.state;
    const uri = inputs.uri || '';
    let credentials = gitRepository?.credentials;

    // isomorphic-git requires a different format for OAuth credentials
    // https://isomorphic-git.org/docs/en/authentication.html
    if (!inputs.oauth2format) {
      if (inputs.token && inputs.username) {
        credentials = {
          username: inputs.username,
          token: inputs.token,
        };
      }
    } else {
      credentials = {
        oauth2format: inputs.oauth2format,
        token: inputs.token || '',
        username: inputs.username || '',
      };
    }

    const author = {
      name: inputs.authorName || '',
      email: inputs.authorEmail || '',
    };

    const patch = {
      uri,
      credentials,
      author,
    };

    if (this._onSubmitEdits) {
      // @ts-expect-error -- TSCONVERSION
      this._onSubmitEdits({ ...gitRepository, ...patch });
    }

    this.hide();
  }

  show(options: {
    gitRepository: GitRepository | null;
    onSubmitEdits: (arg0: GitRepository) => any;
  }) {
    this._onSubmitEdits = options.onSubmitEdits;
    const { gitRepository } = options;
    const inputs: State['inputs'] = {};

    if (gitRepository) {
      const { uri, credentials, author } = gitRepository;

      if (credentials) {
        const isCredentialsOAuth = isGitCredentialsOAuth(credentials);

        inputs.token = isCredentialsOAuth ? credentials.token : '';
        inputs.username = credentials.username;
        inputs.oauth2format = isCredentialsOAuth
          ? credentials.oauth2format
          : undefined;
      }

      if (credentials && 'token' in credentials) {
        inputs.token = credentials.token;
      }

      inputs.authorEmail = author.email;

      inputs.authorName = author.name;

      inputs.uri = uri;
    }

    this.setState({
      gitRepository,
      inputs,
    });
    this.modal?.show();
    setTimeout(() => {
      this.input?.focus();
    }, 100);
  }

  hide() {
    this.modal?.hide();
  }

  render() {
    const { inputs, gitRepository } = this.state;
    const linkIcon = <i className="fa fa-external-link-square" />;
    const oauth2Formats = ['custom', 'github'];
    const oauth2Format = inputs.oauth2format || 'custom';
    const selectedOAuth2FormatIndex = oauth2Formats.findIndex(
      value => value === oauth2Format
    );

    return (
      <Modal ref={this._setModalRef} {...this.props}>
        <ModalHeader>
          Configure Repository{' '}
          <HelpTooltip>
            Sync and collaborate with Git
            <br />
            <Link href={docsGitSync}>Documentation {linkIcon}</Link>
          </HelpTooltip>
        </ModalHeader>
        <ModalBody key={gitRepository ? gitRepository._id : 'new'}>
          <ErrorBoundary>
            <Tabs
              className="react-tabs"
              onSelect={(index: number) =>
                this.setState({
                  inputs: {
                    ...inputs,
                    oauth2format: oauth2Formats[index] as 'github',
                  },
                })
              }
              selectedIndex={selectedOAuth2FormatIndex}
            >
              <TabList>
                <Tab>
                  <button>
                    <i className="fa fa-code-fork" /> Git
                  </button>
                </Tab>
                <Tab>
                  <button>
                    <i className="fa fa-github" /> GitHub
                  </button>
                </Tab>
              </TabList>
              <TabPanel
                className="tabs__tab-panel scrollable"
                selectedClassName="pad pad-top-sm"
              >
                <CustomRepositorySettingsFormGroup
                  onInputChange={this._handleInputChange}
                  inputs={inputs}
                  isGitRepository={Boolean(gitRepository)}
                />
              </TabPanel>

              <TabPanel
                className="tabs__tab-panel"
                selectedClassName="pad pad-top-sm"
                style={{
                  overflow: 'hidden',
                }}
              >
                <GitHubRepositorySetupFormGroup
                  uri={inputs.uri || ''}
                  onChange={({ uri, author, token }) => {
                    this.setState({
                      inputs: {
                        authorEmail: author.email,
                        authorName: author.name,
                        token,
                        oauth2format: 'github',
                        username: token,
                        uri,
                      },
                    });
                  }}
                />
              </TabPanel>
            </Tabs>
          </ErrorBoundary>
        </ModalBody>
        <ModalFooter>
          {gitRepository && (
            <div className="margin-left txt-xs faint monospace selectable">
              {gitRepository._id}
            </div>
          )}
          <div>
            {gitRepository !== null && (
              <button type="button" className="btn" onClick={this._handleReset}>
                Reset
              </button>
            )}
            <button onClick={e => this._handleSubmitEdit(e)} className="btn">
              Done
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}
