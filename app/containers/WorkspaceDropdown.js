import React, {Component, PropTypes} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux'

import Dropdown from '../components/base/Dropdown';
import DropdownDivider from '../components/base/DropdownDivider';
import PromptModal from '../components/PromptModal';
import SettingsModal from '../components/SettingsModal';
import * as WorkspaceActions from '../redux/modules/workspaces';
import * as GlobalActions from '../redux/modules/global';
import * as db from '../database';

class WorkspaceDropdown extends Component {
  _promptUpdateName () {
    const workspace = this._getActiveWorkspace(this.props);

    PromptModal.show({
      headerName: 'Rename Workspace',
      defaultValue: workspace.name
    }).then(name => {
      db.workspaceUpdate(workspace, {name});
    })
  }

  _importDialog () {
    const workspace = this._getActiveWorkspace(this.props);
    this.props.actions.global.importFile(workspace);
  }

  _workspaceCreate () {
    db.workspaceCreate({name: 'New Workspace'}).then(workspace => {
      this.props.actions.workspaces.activate(workspace);
    });
  }

  _getActiveWorkspace (props) {
    // TODO: Factor this out into a selector

    const {entities, workspaces} = props || this.props;
    let workspace = entities.workspaces[workspaces.activeId];
    if (!workspace) {
      workspace = entities.workspaces[Object.keys(entities.workspaces)[0]];
    }

    return workspace;
  }

  render () {
    const {actions, loading, entities, ...other} = this.props;

    const allWorkspaces = Object.keys(entities.workspaces).map(id => entities.workspaces[id]);
    const workspace = this._getActiveWorkspace(this.props);

    return (
      <Dropdown right={true} {...other} className="wide">
        <button className="btn wide">
          <h1 className="no-pad text-left">
            <div className="pull-right">
              {loading ? <i className="fa fa-refresh fa-spin txt-lg"></i> : ''}&nbsp;
              <i className="fa fa-caret-down txt-lg"></i>
            </div>
            {workspace.name}
          </h1>
        </button>
        <ul>

          <DropdownDivider name="Current Workspace"/>

          <li>
            <button onClick={e => db.requestCreate({parentId: workspace._id})}>
              <i className="fa fa-plus-circle"></i> New Request
            </button>
          </li>
          <li>
            <button onClick={e => db.requestGroupCreate({parentId: workspace._id})}>
              <i className="fa fa-folder"></i> New Request Group
            </button>
          </li>
          <li>
            <button onClick={e => this._importDialog()}>
              <i className="fa fa-share-square-o"></i> Import/Export
            </button>
          </li>
          <li>
            <button onClick={e => this._promptUpdateName()}>
              <i className="fa fa-empty"></i> Rename <strong>{workspace.name}</strong>
            </button>
          </li>
          <li>
            <button onClick={e => db.workspaceRemove(workspace)}>
              <i className="fa fa-empty"></i> Delete <strong>{workspace.name}</strong>
            </button>
          </li>

          <DropdownDivider name="Workspaces"/>

          {allWorkspaces.map(w => {
            return w._id === workspace._id ? null : (
              <li key={w._id}>
                <button onClick={() => actions.workspaces.activate(w)}>
                  <i className="fa fa-random"></i> Switch to <strong>{w.name}</strong>
                </button>
              </li>
            )
          })}
          <li>
            <button onClick={e => this._workspaceCreate()}>
              <i className="fa fa-blank"></i> Create Workspace
            </button>
          </li>

          <DropdownDivider name="Insomnia"/>

          <li>
            <button onClick={e => SettingsModal.show()}>
              <i className="fa fa-cog"></i> Settings
            </button>
          </li>
          <li>
            <button><i className="fa fa-blank"></i> Open New Window</button>
          </li>
        </ul>
      </Dropdown>
    )
  }
}

WorkspaceDropdown.propTypes = {
  loading: PropTypes.bool.isRequired,
  workspaces: PropTypes.shape({
    activeId: PropTypes.string
  }),
  entities: PropTypes.shape({
    workspaces: PropTypes.object.isRequired
  }).isRequired,
  actions: PropTypes.shape({
    workspaces: PropTypes.shape({
      activate: PropTypes.func.isRequired,
    }),
    global: PropTypes.shape({
      importFile: PropTypes.func.isRequired
    })
  })
};

function mapStateToProps (state) {
  return {
    workspaces: state.workspaces,
    entities: state.entities,
    actions: state.actions,
    loading: state.global.loading
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: {
      workspaces: bindActionCreators(WorkspaceActions, dispatch),
      global: bindActionCreators(GlobalActions, dispatch)
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(WorkspaceDropdown);
