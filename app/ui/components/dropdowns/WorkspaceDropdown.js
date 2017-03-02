import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import * as classnames from 'classnames';
import {ipcRenderer, shell} from 'electron';
import Dropdown from '../base/dropdown/Dropdown';
import DropdownDivider from '../base/dropdown/DropdownDivider';
import DropdownButton from '../base/dropdown/DropdownButton';
import DropdownItem from '../base/dropdown/DropdownItem';
import DropdownHint from '../base/dropdown/DropdownHint';
import PromptModal from '../modals/PromptModal';
import SettingsModal, {TAB_INDEX_EXPORT} from '../modals/SettingsModal';
import * as models from '../../../models';
import {getAppVersion} from '../../../common/constants';
import {showModal} from '../modals/index';
import {trackEvent} from '../../../analytics/index';
import Link from '../base/Link';
import WorkspaceSettingsModal from '../modals/WorkspaceSettingsModal';
import WorkspaceShareSettingsModal from '../modals/WorkspaceShareSettingsModal';
import * as session from '../../../sync/session';
import PromptButton from '../base/PromptButton';
import LoginModal from '../modals/LoginModal';

@autobind
class WorkspaceDropdown extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      loggedIn: false
    };
  }

  _handleDropdownOpen () {
    if (this.state.loggedIn !== session.isLoggedIn()) {
      this.setState({loggedIn: session.isLoggedIn()});
    }
  }

  _handleShowLogin () {
    showModal(LoginModal);
  }

  _handleShowExport () {
    showModal(SettingsModal, TAB_INDEX_EXPORT);
  }
  _handleShowSettings () {
    showModal(SettingsModal);
  }
  _handleShowWorkspaceSettings () {
    showModal(WorkspaceSettingsModal, {
      workspace: this.props.activeWorkspace,
    });
  }

  _handleShowShareSettings () {
    showModal(WorkspaceShareSettingsModal, {
      workspace: this.props.activeWorkspace,
    });
  }

  _handleSwitchWorkspace (workspaceId) {
    this.props.handleSetActiveWorkspace(workspaceId);
    trackEvent('Workspace', 'Switch');
  }

  async _handleWorkspaceCreate (noTrack) {
    const name = await showModal(PromptModal, {
      headerName: 'Create New Workspace',
      defaultValue: 'My Workspace',
      submitName: 'Create',
      selectText: true
    });

    const workspace = await models.workspace.create({name});
    this.props.handleSetActiveWorkspace(workspace._id);

    if (!noTrack) {
      trackEvent('Workspace', 'Create');
    }
  }

  render () {
    const {
      className,
      workspaces,
      activeWorkspace,
      isLoading,
      ...other
    } = this.props;

    const nonActiveWorkspaces = workspaces.filter(w => w._id !== activeWorkspace._id);

    const classes = classnames(className, 'wide', 'workspace-dropdown');
    return (
      <Dropdown className={classes} onOpen={this._handleDropdownOpen} {...other}>
        <DropdownButton className="btn wide">
          <h1 className="no-pad text-left">
            <div className="pull-right">
              {isLoading ? <i className="fa fa-refresh fa-spin"/> : null}
              {" "}
              <i className="fa fa-caret-down"/>
            </div>
            {activeWorkspace.name}
          </h1>
        </DropdownButton>
        <DropdownDivider>{activeWorkspace.name}</DropdownDivider>
        <DropdownItem onClick={this._handleShowWorkspaceSettings}>
          <i className="fa fa-wrench"/> Workspace Settings
          <DropdownHint char="&#8679;,"/>
        </DropdownItem>

        <DropdownItem onClick={this._handleShowShareSettings}>
          <i className="fa fa-globe"/> Share <strong>{activeWorkspace.name}</strong>
        </DropdownItem>

        <DropdownDivider>Switch Workspace</DropdownDivider>

        {nonActiveWorkspaces.map(w => (
          <DropdownItem key={w._id} onClick={this._handleSwitchWorkspace} value={w._id}>
            <i className="fa fa-random"/> To <strong>{w.name}</strong>
          </DropdownItem>
        ))}
        <DropdownItem onClick={this._handleWorkspaceCreate}>
          <i className="fa fa-empty"/> New Workspace
        </DropdownItem>

        <DropdownDivider>Insomnia Version {getAppVersion()}</DropdownDivider>

        <DropdownItem onClick={this._handleShowSettings}>
          <i className="fa fa-cog"/> Preferences
          <DropdownHint char=","/>
        </DropdownItem>
        <DropdownItem onClick={this._handleShowExport}>
          <i className="fa fa-share"/> Import/Export
        </DropdownItem>
        {!this.state.loggedIn ? [
            <DropdownItem key="login" onClick={this._handleShowLogin}>
              <i className="fa fa-sign-in"/> Log In
            </DropdownItem>,
            <DropdownItem key="invite"
                          buttonClass={Link}
                          href="https://insomnia.rest/pricing/"
                          button>
              <i className="fa fa-users"/> Upgrade to Plus
            </DropdownItem>,
          ] : [
            <DropdownItem key="manage"
                          buttonClass={Link}
                          href="https://insomnia.rest/app/"
                          button>
              <i className="fa fa-user"/> Manage Account
            </DropdownItem>,
            <DropdownItem key="logout"
                          buttonClass={PromptButton}
                          onClick={session.logout}
                          addIcon>
              <i className="fa fa-sign-out"/> Log Out
            </DropdownItem>,
          ]}
      </Dropdown>
    )
  }
}

WorkspaceDropdown.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  handleImportFile: PropTypes.func.isRequired,
  handleExportFile: PropTypes.func.isRequired,
  handleSetActiveWorkspace: PropTypes.func.isRequired,
  workspaces: PropTypes.arrayOf(PropTypes.object).isRequired,
  activeWorkspace: PropTypes.object.isRequired,
};

export default WorkspaceDropdown;
