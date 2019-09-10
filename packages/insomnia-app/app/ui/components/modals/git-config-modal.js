// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { Workspace } from '../../../models/workspace';
import type { GitAuthor, GitRemoteConfig } from '../../../sync/git/git-vcs';
import GitVCS from '../../../sync/git/git-vcs';
import { getDataDirectory } from '../../../common/misc';
import path from 'path';
import NeDBPlugin from '../../../sync/git/ne-db-plugin';
import FSPlugin from '../../../sync/git/fs-plugin';
import { routableFSPlugin } from '../../../sync/git/routable-fs-plugin';

type Props = {|
  workspace: Workspace,
  vcs: GitVCS,
|};

type State = {|
  initializing: boolean,
  remote: GitRemoteConfig,
  author: GitAuthor,
|};

@autobind
class GitConfigModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

  constructor(props: Props) {
    super(props);

    this.state = {
      initializing: true,
      remote: {
        remote: 'origin',
        url: '',
      },
      author: {
        name: '',
        email: '',
      },
    };
  }

  async componentDidMount() {
    const { workspace, vcs } = this.props;
    const dataDir = getDataDirectory();
    const gitDir = path.join(dataDir, `version-control/git/${workspace._id}.git`);

    // Create FS plugin
    const pDir = NeDBPlugin.createPlugin(workspace._id);
    const pGit = FSPlugin.createPlugin();
    const fsPlugin = routableFSPlugin(pDir, { [gitDir]: pGit });

    // Init VCS
    await vcs.init('/', fsPlugin, gitDir);
    await this._refreshState({ initializing: false });
  }

  async _refreshState(newState?: Object) {
    const { vcs } = this.props;
    const remote = (await vcs.getRemote('origin')) || this.state.remote;
    const author = await vcs.getAuthor();

    this.setState({
      ...newState,
      remote,
      author,
    });
  }

  _setModalRef(ref: ?Modal) {
    this.modal = ref;
  }

  async _handleAuthorNameChange(e: SyntheticEvent<HTMLInputElement>) {
    const { vcs } = this.props;

    const { value: name } = e.currentTarget;
    const { email } = await vcs.getAuthor();

    await vcs.setAuthor(name, email);
    await this._refreshState();
  }

  async _handleAuthorEmailChange(e: SyntheticEvent<HTMLInputElement>) {
    const { vcs } = this.props;

    const { value: email } = e.currentTarget;
    const { name } = await vcs.getAuthor();

    await vcs.setAuthor(name, email);
    await this._refreshState();
  }

  async _handleRemoteChange(e: SyntheticEvent<HTMLInputElement>) {
    const { vcs } = this.props;
    const { remote } = this.state;

    const name = e.currentTarget.getAttribute('data-remote');
    if (!name) {
      throw new Error('No name found to edit remote');
    }

    if (!remote) {
      return;
    }

    await vcs.addRemote(name, e.currentTarget.value);
  }

  async show(options: {}) {
    await this._refreshState();

    if (this.modal) {
      this.modal.show();
    }
  }

  renderRemote(r: GitRemoteConfig) {
    return (
      <div className="form-row" key={r.remote}>
        <div className="form-control form-control--outlined">
          <label>
            Remote
            <input readOnly disabled type="text" placeholder="origin" defaultValue={r.remote} />
          </label>
        </div>
        <div className="form-control form-control--outlined">
          <label>
            URL
            <input
              required
              type="url"
              placeholder="https://github.com/user/repo"
              defaultValue={r.url}
              data-remote={r.remote}
              onChange={this._handleRemoteChange}
            />
          </label>
        </div>
      </div>
    );
  }

  renderBody() {
    const { author, remote, initializing } = this.state;

    if (initializing) {
      return null;
    }

    return (
      <React.Fragment>
        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Committer Name
              <input
                required
                type="text"
                placeholder="Name"
                defaultValue={author.name}
                onChange={this._handleAuthorNameChange}
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              Committer Email
              <input
                required
                type="email"
                placeholder="Email"
                defaultValue={author.email}
                onChange={this._handleAuthorEmailChange}
              />
            </label>
          </div>
        </div>

        <hr />
        <h2>Remotes</h2>
        {this.renderRemote(remote)}
      </React.Fragment>
    );
  }

  render() {
    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Git Config</ModalHeader>
        <ModalBody className="wide pad">{this.renderBody()}</ModalBody>
      </Modal>
    );
  }
}

export default GitConfigModal;
