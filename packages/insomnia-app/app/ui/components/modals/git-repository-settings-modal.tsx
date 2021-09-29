import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { docsGitAccessToken, docsGitSync } from '../../../common/documentation';
import type { GitRepository } from '../../../models/git-repository';
import { deleteGitRepository } from '../../../models/helpers/git-repository-operations';
import { Link } from '../base/link';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { HelpTooltip } from '../help-tooltip';

interface State {
  gitRepository: GitRepository | null;
  inputs: {
    uri?: string;
    authorName?: string;
    authorEmail?: string;
    username?: string;
    token?: string;
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

  async _handleSubmitEdit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const { inputs, gitRepository } = this.state;
    const uri = inputs.uri || '';
    const credentials = inputs.token
      ? {
        type: 'token',
        username: inputs.username,
        token: inputs.token,
      }
      : null;
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
    const inputs = {};

    if (gitRepository) {
      const creds = gitRepository.credentials || {};
      // @ts-expect-error -- TSCONVERSION
      inputs.token = typeof creds.token === 'string' ? creds.token : '';
      // @ts-expect-error -- TSCONVERSION
      inputs.authorEmail = gitRepository.author.email;
      // @ts-expect-error -- TSCONVERSION
      inputs.authorName = gitRepository.author.name;
      // @ts-expect-error -- TSCONVERSION
      inputs.username = gitRepository.credentials?.username || '';
      // @ts-expect-error -- TSCONVERSION
      inputs.uri = gitRepository.uri;
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
    return (
      <form onSubmit={this._handleSubmitEdit}>
        <Modal ref={this._setModalRef} {...this.props}>
          <ModalHeader>
            Configure Repository{' '}
            <HelpTooltip>
              Sync and collaborate with Git
              <br />
              <Link href={docsGitSync}>Documentation {linkIcon}</Link>
            </HelpTooltip>
          </ModalHeader>
          <ModalBody key={gitRepository ? gitRepository._id : 'new'} className="pad">
            <div className="form-control form-control--outlined">
              <label>
                Git URI (https)
                <input
                  required
                  ref={this._setInputRef}
                  name="uri"
                  defaultValue={inputs.uri}
                  disabled={!!gitRepository}
                  onChange={this._handleInputChange}
                  placeholder="https://github.com/org/repo.git"
                />
              </label>
            </div>
            <div className="form-row">
              <div className="form-control form-control--outlined">
                <label>
                  Author Name
                  <input
                    required
                    type="text"
                    name="authorName"
                    placeholder="Name"
                    defaultValue={inputs.authorName}
                    onChange={this._handleInputChange}
                  />
                </label>
              </div>
              <div className="form-control form-control--outlined">
                <label>
                  Author Email
                  <input
                    required
                    type="email"
                    name="authorEmail"
                    placeholder="Email"
                    defaultValue={inputs.authorEmail}
                    onChange={this._handleInputChange}
                  />
                </label>
              </div>
            </div>
            <div className="form-row">
              <div className="form-control form-control--outlined">
                <label>
                  Username
                  <input
                    required
                    type="text"
                    name="username"
                    placeholder="MyUser"
                    defaultValue={inputs.username}
                    onChange={this._handleInputChange}
                  />
                </label>
              </div>
              <div className="form-control form-control--outlined">
                <label>
                  Authentication Token
                  <HelpTooltip className="space-left">
                    Create a personal access token
                    <br />
                    <Link href={docsGitAccessToken.github}>Github {linkIcon}</Link>
                    {' | '}
                    <Link href={docsGitAccessToken.gitlab}>Gitlab {linkIcon}</Link>
                    {' | '}
                    <Link href={docsGitAccessToken.bitbucket}>Bitbucket {linkIcon}</Link>
                    {' | '}
                    <Link href={docsGitAccessToken.bitbucketServer}>
                      Bitbucket Server {linkIcon}
                    </Link>
                  </HelpTooltip>
                  <input
                    required
                    type="password"
                    name="token"
                    defaultValue={inputs.token}
                    onChange={this._handleInputChange}
                    placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"
                  />
                </label>
              </div>
            </div>
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
              <button className="btn">Done</button>
            </div>
          </ModalFooter>
        </Modal>
      </form>
    );
  }
}
