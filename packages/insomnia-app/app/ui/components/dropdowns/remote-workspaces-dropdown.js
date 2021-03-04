// @flow

import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import * as session from '../../../account/session';
import VCS from '../../../sync/vcs';
import type { Project } from '../../../sync/types';
import { Dropdown, DropdownDivider, DropdownItem, Button, Tooltip } from 'insomnia-components';
import type { Workspace } from '../../../models/workspace';
import HelpTooltip from '../help-tooltip';
import * as models from '../../../models';
import * as db from '../../../common/database';
import { showAlert } from '../modals';
import { stringsPlural } from '../../../common/strings';

type Props = {
  className?: string,
  vcs?: VCS,
  workspaces: Array<Workspace>,
};

type State = {
  loading: boolean,
  localProjects: Array<Project>,
  pullingProjects: { [string]: boolean },
  remoteProjects: Array<Project>,
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class RemoteWorkspacesDropdown extends React.Component<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      localProjects: [],
      pullingProjects: {},
      remoteProjects: [],
    };
  }

  async _refreshRemoteWorkspaces() {
    const { vcs } = this.props;
    if (!vcs) {
      return;
    }

    if (!session.isLoggedIn()) {
      return;
    }

    this.setState({ loading: true });

    const remoteProjects = await vcs.remoteProjects();
    const localProjects = await vcs.localProjects();
    this.setState({ remoteProjects, localProjects, loading: false });
  }

  async _handlePullRemoteWorkspace(project: Project) {
    const { vcs } = this.props;
    if (!vcs) {
      throw new Error('VCS is not defined');
    }

    this.setState(state => ({
      pullingProjects: { ...state.pullingProjects, [project.id]: true },
    }));

    try {
      // Clone old VCS so we don't mess anything up while working on other projects
      const newVCS = vcs.newInstance();

      // Remove all projects for workspace first
      await newVCS.removeProjectsForRoot(project.rootDocumentId);

      // Set project, checkout master, and pull
      const defaultBranch = 'master';

      await newVCS.setProject(project);
      await newVCS.checkout([], defaultBranch);

      const remoteBranches = await newVCS.getRemoteBranches();
      const defaultBranchMissing = !remoteBranches.includes(defaultBranch);

      // The default branch does not exist, so we create it and the workspace locally
      if (defaultBranchMissing) {
        const workspace: Workspace = await models.initModel(models.workspace.type, {
          _id: project.rootDocumentId,
          name: project.name,
        });

        await db.upsert(workspace);
      } else {
        await newVCS.pull([]); // There won't be any existing docs since it's a new pull

        const flushId = await db.bufferChanges();
        for (const doc of await newVCS.allDocuments()) {
          await db.upsert(doc);
        }
        await db.flushChanges(flushId);
      }

      await this._refreshRemoteWorkspaces();
    } catch (err) {
      this._dropdown && this._dropdown.hide();
      showAlert({
        title: 'Pull Error',
        message: `Failed to pull workspace. ${err.message}`,
      });
    }

    this.setState(state => ({
      pullingProjects: { ...state.pullingProjects, [project.id]: false },
    }));
  }

  componentDidUpdate(prevProps: Props) {
    // Reload workspaces if we just got a new VCS instance
    if (this.props.vcs && !prevProps.vcs) {
      this._refreshRemoteWorkspaces();
    }
  }

  componentDidMount() {
    this._refreshRemoteWorkspaces();
  }

  renderButton(disabled = false) {
    return (
      <Button className={this.props.className} disabled={disabled}>
        Pull
        <i className="fa fa-caret-down pad-left-sm" />
      </Button>
    );
  }

  render() {
    const { workspaces } = this.props;

    const { loading, remoteProjects, localProjects, pullingProjects } = this.state;

    if (!session.isLoggedIn()) {
      return (
        <Tooltip message="Please log in to access your remote collections" position="bottom">
          {this.renderButton(true)}
        </Tooltip>
      );
    }

    const missingRemoteProjects = remoteProjects.filter(({ id, rootDocumentId }) => {
      const localProjectExists = localProjects.find(p => p.id === id);
      const workspaceExists = workspaces.find(w => w._id === rootDocumentId);

      // Mark as missing if:
      //   - the project doesn't yet exists locally
      //   - the project exists locally but somehow the workspace doesn't anymore
      return !(workspaceExists && localProjectExists);
    });

    const button = this.renderButton();

    return (
      <Dropdown onOpen={this._refreshRemoteWorkspaces} renderButton={button}>
        <DropdownDivider>
          Remote {stringsPlural.collection}
          <HelpTooltip>
            These {stringsPlural.collection.toLowerCase()} have been shared with you via Insomnia
            Sync and do not yet exist on your machine.
          </HelpTooltip>{' '}
          {loading && <i className="fa fa-spin fa-refresh" />}
        </DropdownDivider>
        {missingRemoteProjects.length === 0 && (
          <DropdownItem disabled>Nothing to pull</DropdownItem>
        )}
        {missingRemoteProjects.map(p => (
          <DropdownItem
            key={p.id}
            stayOpenAfterClick
            onClick={() => this._handlePullRemoteWorkspace(p)}
            icon={
              pullingProjects[p.id] ? (
                <i className="fa fa-refresh fa-spin" />
              ) : (
                <i className="fa fa-cloud-download" />
              )
            }>
            <span>
              Pull <strong>{p.name}</strong>
            </span>
          </DropdownItem>
        ))}
      </Dropdown>
    );
  }
}

export default RemoteWorkspacesDropdown;
