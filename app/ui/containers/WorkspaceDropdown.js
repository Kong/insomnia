import React, {Component, PropTypes} from 'react';
import {ipcRenderer, shell} from 'electron';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import PromptButton from '../components/base/PromptButton';
import {Dropdown, DropdownDivider, DropdownButton, DropdownItem, DropdownHint} from '../components/base/dropdown';
import PromptModal from '../components/modals/PromptModal';
import AlertModal from '../components/modals/AlertModal';
import SettingsModal from '../components/modals/SettingsModal';
import ChangelogModal from '../components/modals/ChangelogModal';
import * as GlobalActions from '../redux/modules/global';
import * as models from '../../models';
import {getAppVersion} from '../../common/constants';
import {showModal} from '../components/modals/index';

class WorkspaceDropdown extends Component {
  async _promptUpdateName () {
    const workspace = this._getActiveWorkspace(this.props);

    const name = await showModal(PromptModal, {
      headerName: 'Rename Workspace',
      defaultValue: workspace.name
    });

    models.workspace.update(workspace, {name});
  }

  async _workspaceCreate () {
    const name = await showModal(PromptModal, {
      headerName: 'Create New Workspace',
      defaultValue: 'My Workspace',
      submitName: 'Create',
      selectText: true
    });

    const workspace = await models.workspace.create({name});
    this.props.actions.global.activateWorkspace(workspace);
  }

  async _workspaceRemove () {
    const count = await models.workspace.count();
    if (count <= 1) {
      showModal(AlertModal, {
        title: 'Delete Unsuccessful',
        message: 'You cannot delete your last workspace.'
      });
    } else {
      const workspace = this._getActiveWorkspace(this.props);
      models.workspace.remove(workspace);
    }
  }

  _getActiveWorkspace (props) {
    // TODO: Factor this out into a selector

    const {entities, global} = props || this.props;
    let workspace = entities.workspaces[global.activeWorkspaceId];
    if (!workspace) {
      workspace = entities.workspaces[Object.keys(entities.workspaces)[0]];
    }

    return workspace;
  }

  render () {
    const {className, actions, global, entities, ...other} = this.props;

    const allWorkspaces = Object.keys(entities.workspaces).map(id => entities.workspaces[id]);
    const workspace = this._getActiveWorkspace(this.props);

    return (
      <Dropdown key={workspace._id} className={className + ' wide workspace-dropdown'} {...other}>
        <DropdownButton className="btn wide">
          <h1 className="no-pad text-left">
            <div className="pull-right">
              {global.loading ?
                <i className="fa fa-refresh fa-spin txt-lg"></i> : ''}&nbsp;
              <i className="fa fa-caret-down"></i>
            </div>
            {workspace.name}
          </h1>
        </DropdownButton>
        <DropdownDivider name="Current Workspace"/>
        <DropdownItem onClick={e => this._promptUpdateName()}>
          <i className="fa fa-pencil-square-o"></i> Rename
          {" "}
          <strong>{workspace.name}</strong>
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton}
                      onClick={e => this._workspaceRemove()}
                      addIcon={true}>
          <i className="fa fa-trash-o"></i> Delete
          {" "}
          <strong>{workspace.name}</strong>
        </DropdownItem>

        <DropdownDivider name="Workspaces"/>

        {allWorkspaces.map(w => w._id === workspace._id ? null : (
          <DropdownItem key={w._id} onClick={() => actions.global.activateWorkspace(w)}>
            <i className="fa fa-random"></i> Switch to
            {" "}
            <strong>{w.name}</strong>
          </DropdownItem>
        ))}
        <DropdownItem onClick={e => this._workspaceCreate()}>
          <i className="fa fa-blank"></i> New Workspace
        </DropdownItem>

        <DropdownDivider name={`Insomnia Version ${getAppVersion()}`}/>

        <DropdownItem onClick={e => showModal(SettingsModal, 1)}>
          <i className="fa fa-share"></i> Import/Export
        </DropdownItem>
        <DropdownItem onClick={e => showModal(SettingsModal, 2)}>
          <i className="fa fa-refresh"></i> Cloud Sync
        </DropdownItem>
        <DropdownItem onClick={e => showModal(SettingsModal)}>
          <i className="fa fa-cog"></i> Settings
          <DropdownHint char=","></DropdownHint>
        </DropdownItem>
        <DropdownItem onClick={e => showModal(ChangelogModal)}>
          <i className="fa fa-blank"></i> Changelog
        </DropdownItem>
      </Dropdown>
    )
  }
}

WorkspaceDropdown.propTypes = {
  global: PropTypes.shape({
    loading: PropTypes.bool.isRequired,
    activeWorkspaceId: PropTypes.string.isRequired
  }),
  entities: PropTypes.shape({
    workspaces: PropTypes.object.isRequired
  }).isRequired,
  actions: PropTypes.shape({
    global: PropTypes.shape({
      importFile: PropTypes.func.isRequired,
      exportFile: PropTypes.func.isRequired,
      activateWorkspace: PropTypes.func.isRequired,
    })
  })
};

function mapStateToProps (state) {
  return {
    global: state.global,
    entities: state.entities,
    actions: state.actions
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: {
      global: bindActionCreators(GlobalActions, dispatch)
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(WorkspaceDropdown);
