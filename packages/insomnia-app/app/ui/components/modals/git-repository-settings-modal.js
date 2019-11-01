// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import * as models from '../../../models';
import type { GitRepository } from '../../../models/git-repository';
import ModalFooter from '../base/modal-footer';

type Props = {|
  handleSetActiveGitRepository: (string | null) => Promise<void>,
|};

type State = {|
  gitRepository: GitRepository | null,
  inputs: {
    uri?: string,
    authorName?: string,
    authorEmail?: string,
    token?: string,
  },
|};

@autobind
class GitRepositorySettingsModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  input: ?HTMLInputElement;

  constructor(props: Props) {
    super(props);

    this.state = {
      inputs: {},
      gitRepository: null,
    };
  }

  _setModalRef(n: ?Modal) {
    this.modal = n;
  }

  _setInputRef(n: ?HTMLInputElement) {
    this.input = n;
  }

  async _handleInputChange(e: SyntheticEvent<HTMLInputElement>) {
    const { name, value } = e.currentTarget;
    this.setState(state => ({
      inputs: { ...state.inputs, [name]: value },
    }));
  }

  async _handleReset() {
    const { handleSetActiveGitRepository } = this.props;
    const { gitRepository } = this.state;

    if (gitRepository) {
      await models.gitRepository.remove(gitRepository);
      await handleSetActiveGitRepository(null);
    }

    this.hide();
  }

  async _handleSubmitEdit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const { handleSetActiveGitRepository } = this.props;
    const { inputs, gitRepository } = this.state;

    const uri = inputs.uri || '';

    const credentials = inputs.token
      ? {
          type: 'token',
          token: inputs.token,
        }
      : null;

    const author = {
      name: inputs.authorName || '',
      email: inputs.authorEmail || '',
    };

    const patch = { uri, credentials, author };

    const repo =
      gitRepository !== null
        ? await models.gitRepository.update(gitRepository, patch)
        : await models.gitRepository.create(patch);

    await handleSetActiveGitRepository(repo._id);

    this.hide();
  }

  show(options: { gitRepository: GitRepository | null } = {}) {
    const { gitRepository } = options;

    const inputs = {};

    if (gitRepository) {
      const creds = gitRepository.credentials || {};
      inputs.token = typeof creds.token === 'string' ? creds.token : '';
      inputs.authorEmail = gitRepository.author.email;
      inputs.authorName = gitRepository.author.name;
      inputs.uri = gitRepository.uri;
    }

    this.setState({ gitRepository, inputs });

    this.modal && this.modal.show();

    setTimeout(() => {
      this.input && this.input.focus();
    }, 100);
  }

  hide() {
    this.modal && this.modal.hide();
  }

  render() {
    const { inputs, gitRepository } = this.state;

    return (
      <form onSubmit={this._handleSubmitEdit}>
        <Modal ref={this._setModalRef} {...this.props}>
          <ModalHeader>Configure Repository</ModalHeader>
          <ModalBody key={gitRepository ? gitRepository._id : 'new'} className="pad">
            <div className="form-control form-control--outlined">
              <label>
                Git URI (https)
                <input
                  required
                  ref={this._setInputRef}
                  type="url"
                  name="uri"
                  defaultValue={inputs.uri}
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
            <div className="form-control form-control--outlined">
              <label>
                Authentication Token
                <input
                  type="password"
                  name="token"
                  defaultValue={inputs.token}
                  onChange={this._handleInputChange}
                  placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"
                />
              </label>
            </div>
          </ModalBody>
          <ModalFooter>
            <div>
              {gitRepository !== null && (
                <button type="button" className="btn" onClick={this._handleReset}>
                  Reset
                </button>
              )}
              <button className="btn">{gitRepository ? 'Update' : 'Save'}</button>
            </div>
          </ModalFooter>
        </Modal>
      </form>
    );
  }
}

export default GitRepositorySettingsModal;
