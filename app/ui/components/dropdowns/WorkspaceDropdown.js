import React, {Component, PropTypes} from 'react';
import {ipcRenderer, shell} from 'electron';
import PromptButton from '../base/PromptButton';
import {Dropdown, DropdownDivider, DropdownButton, DropdownItem, DropdownHint} from '../base/dropdown';
import PromptModal from '../modals/PromptModal';
import AlertModal from '../modals/AlertModal';
import SettingsModal from '../modals/SettingsModal';
import ChangelogModal from '../modals/ChangelogModal';
import * as models from '../../../models';
import {getAppVersion} from '../../../common/constants';
import {showModal} from '../modals/index';
import {TAB_INDEX_EXPORT} from '../modals/SettingsModal';
import {trackEvent} from '../../../analytics/index';
import Link from '../base/Link';

class WorkspaceDropdown extends Component {
  async _promptUpdateName () {
    const {activeWorkspace} = this.props;

    const name = await showModal(PromptModal, {
      headerName: 'Rename Workspace',
      defaultValue: activeWorkspace.name
    });

    models.workspace.update(activeWorkspace, {name});
  }

  async _workspaceCreate () {
    const name = await showModal(PromptModal, {
      headerName: 'Create New Workspace',
      defaultValue: 'My Workspace',
      submitName: 'Create',
      selectText: true
    });

    const workspace = await models.workspace.create({name});
    this.props.handleSetActiveWorkspace(workspace._id);
  }

  async _workspaceRemove () {
    const {workspaces, activeWorkspace} = this.props;
    if (workspaces.length <= 1) {
      showModal(AlertModal, {
        title: 'Delete Unsuccessful',
        message: 'You cannot delete your last workspace.'
      });
    } else {
      models.workspace.remove(activeWorkspace);
    }
  }

  render () {
    const {
      className,
      workspaces,
      activeWorkspace,
      handleSetActiveWorkspace,
      isLoading,
      ...other
    } = this.props;

    return (
      <Dropdown key={activeWorkspace._id}
                className={className + ' wide workspace-dropdown'}
                {...other}>
        <DropdownButton className="btn wide">
          <h1 className="no-pad text-left">
            <div className="pull-right">
              {isLoading ?
                <i className="fa fa-refresh fa-spin txt-lg"></i> : ''}&nbsp;
              <i className="fa fa-caret-down"></i>
            </div>
            {activeWorkspace.name}
          </h1>
        </DropdownButton>
        <DropdownDivider name="Current Workspace"/>
        <DropdownItem onClick={e => {
          this._promptUpdateName();
          trackEvent('Workspace', 'Rename');
        }}>
          <i className="fa fa-pencil-square-o"></i> Rename
          {" "}
          <strong>{activeWorkspace.name}</strong>
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton}
                      onClick={e => {
                        this._workspaceRemove();
                        trackEvent('Workspace', 'Delete');
                      }}
                      addIcon={true}>
          <i className="fa fa-trash-o"></i> Delete
          {" "}
          <strong>{activeWorkspace.name}</strong>
        </DropdownItem>

        <DropdownDivider name="Workspaces"/>

        {workspaces.map(w => w._id === activeWorkspace._id ? null : (
          <DropdownItem key={w._id} onClick={() => {
            handleSetActiveWorkspace(w._id);
            trackEvent('Workspace', 'Switch');
          }}>
            <i className="fa fa-random"></i> Switch to
            {" "}
            <strong>{w.name}</strong>
          </DropdownItem>
        ))}
        <DropdownItem onClick={e => {
          this._workspaceCreate();
          trackEvent('Workspace', 'Create');
        }}>
          <i className="fa fa-blank"></i> New Workspace
        </DropdownItem>

        <DropdownDivider name={`Insomnia Version ${getAppVersion()}`}/>

        <DropdownItem onClick={e => showModal(SettingsModal, TAB_INDEX_EXPORT)}>
          <i className="fa fa-share"></i> Import/Export
        </DropdownItem>
        <DropdownItem onClick={e => showModal(SettingsModal)}>
          <i className="fa fa-cog"></i> Settings
          <DropdownHint char=","></DropdownHint>
        </DropdownItem>
        <DropdownItem buttonClass={Link} href="https://insomnia.rest/teams/" button={true}>
          <i className="fa fa-users"></i> Insomnia for Teams
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
