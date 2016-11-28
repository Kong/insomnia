import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';
import {ipcRenderer, shell} from 'electron';
import PromptButton from '../base/PromptButton';
import {Dropdown, DropdownDivider, DropdownButton, DropdownItem, DropdownHint} from '../base/dropdown';
import PromptModal from '../modals/PromptModal';
import AlertModal from '../modals/AlertModal';
import SettingsModal, {TAB_INDEX_EXPORT} from '../modals/SettingsModal';
import * as models from '../../../models';
import {getAppVersion} from '../../../common/constants';
import {showModal} from '../modals/index';
import {trackEvent} from '../../../analytics/index';
import Link from '../base/Link';
import WorkspaceSettingsModal from '../modals/WorkspaceSettingsModal';

class WorkspaceDropdown extends Component {
  _handleShowExport = () => showModal(SettingsModal, TAB_INDEX_EXPORT);
  _handleShowSettings = () => showModal(SettingsModal);
  _handleShowWorkspaceSettings = () => {
    showModal(WorkspaceSettingsModal, {
      workspace: this.props.activeWorkspace,
    });
  };

  _handleSwitchWorkspace = workspaceId => {
    this.props.handleSetActiveWorkspace(workspaceId);
    trackEvent('Workspace', 'Switch');
  };

  _handleWorkspaceCreate = async noTrack => {
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
  };

  _handleWorkspaceRemove = async () => {
    const {workspaces, activeWorkspace} = this.props;
    if (workspaces.length <= 1) {
      await showModal(AlertModal, {
        title: 'Deleting Last Workspace',
        message: 'Since you are deleting your only workspace, a new one will be created for you'
      });

      await this._handleWorkspaceCreate(true);

      trackEvent('Workspace', 'Delete', 'Last');
    } else {
      trackEvent('Workspace', 'Delete');
    }

    models.workspace.remove(activeWorkspace);
  };

  render () {
    const {
      className,
      workspaces,
      activeWorkspace,
      isLoading,
      ...other
    } = this.props;

    const nonActiveWorkspaces = workspaces.filter(w => w._id !== activeWorkspace._id);

    return (
      <Dropdown key={activeWorkspace._id}
                className={classnames(className, 'wide', 'workspace-dropdown')}
                {...other}>
        <DropdownButton className="btn wide">
          <h1 className="no-pad text-left">
            <div className="pull-right">
              {isLoading ? <i className="fa fa-refresh fa-spin txt-lg"/> : null}
              {" "}
              <i className="fa fa-caret-down"/>
            </div>
            {activeWorkspace.name}
          </h1>
        </DropdownButton>
        <DropdownDivider name={activeWorkspace.name}/>
        <DropdownItem onClick={this._handleShowWorkspaceSettings}>
          <i className="fa fa-wrench"/> Configure Workspace
          <DropdownHint char="&#8679;,"/>
        </DropdownItem>

        <DropdownDivider name="Switch Workspace"/>

        {nonActiveWorkspaces.map(w => (
          <DropdownItem key={w._id} onClick={this._handleSwitchWorkspace} value={w._id}>
            <i className="fa fa-random"/> To <strong>{w.name}</strong>
          </DropdownItem>
        ))}
        <DropdownItem onClick={this._handleWorkspaceCreate}>
          <i className="fa fa-empty"/> New Workspace
        </DropdownItem>

        <DropdownDivider name={`Insomnia Version ${getAppVersion()}`}/>

        <DropdownItem onClick={this._handleShowSettings}>
          <i className="fa fa-cog"/> Preferences
          <DropdownHint char=","></DropdownHint>
        </DropdownItem>
        <DropdownItem onClick={this._handleShowExport}>
          <i className="fa fa-share"/> Import/Export
        </DropdownItem>
        <DropdownItem buttonClass={Link} href="https://insomnia.rest/teams/" button={true}>
          <i className="fa fa-users"/> Invite Your Team
        </DropdownItem>
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
