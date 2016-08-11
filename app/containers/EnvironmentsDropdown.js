import React, {Component, PropTypes} from 'react';
import {ipcRenderer} from 'electron';
import {connect} from 'react-redux'

import EnvironmentsModal from '../components/modals/WorkspaceEnvironmentsEditModal';
import Dropdown from '../components/base/Dropdown';
import DropdownDivider from '../components/base/DropdownDivider';
import {getModal} from '../components/modals/index';
import * as db from '../database';


class EnvironmentsDropdown extends Component {
  _getActiveWorkspace (props) {
    // TODO: Factor this out into a selector

    const {entities, workspaces} = props || this.props;
    let workspace = entities.workspaces[workspaces.activeId];
    if (!workspace) {
      workspace = entities.workspaces[Object.keys(entities.workspaces)[0]];
    }

    return workspace;
  }

  _handleActivateEnvironment (environment) {
    const workspace = this._getActiveWorkspace();
    db.workspaceUpdate(workspace, {activeEnvironmentId: environment._id});
  }

  render () {
    const {className, entities, ...other} = this.props;
    const workspace = this._getActiveWorkspace(this.props);

    const allEnvironments = Object.keys(entities.environments).map(id => entities.environments[id]);
    const baseEnvironment = allEnvironments.find(e => e.parentId === workspace._id);
    const subEnvironments = allEnvironments.filter(e => e.parentId === (baseEnvironment && baseEnvironment._id));
    const activeEnvironment = allEnvironments.find(e => e._id === workspace.activeEnvironmentId) || baseEnvironment;

    return (
      <Dropdown {...other} className={className + ' wide'}>
        <button className="btn btn--super-compact no-wrap">
          <div className="sidebar__menu__thing">
            <span>
              {activeEnvironment && activeEnvironment !== baseEnvironment ? activeEnvironment.name : 'No Environment'}
              </span>
            &nbsp;
            <i className="fa fa-caret-down"></i>
          </div>
        </button>
        <ul>
          <DropdownDivider name="Change Environment"/>
          {subEnvironments.map(environment => (
            <li key={environment._id}>
              <button onClick={() => this._handleActivateEnvironment(environment)}>
                <i className="fa fa-random"></i> Use <strong>{environment.name}</strong>
              </button>
            </li>
          ))}
          <li>
            <button onClick={() => this._handleActivateEnvironment(baseEnvironment)}>
              <i className="fa fa-empty"></i> No Environment
            </button>
          </li>
          <DropdownDivider name="General"/>
          <li>
            <button onClick={e => getModal(EnvironmentsModal).show(workspace)}>
              <i className="fa fa-wrench"></i> Manage Environments
            </button>
          </li>
        </ul>
      </Dropdown>
    )
  }
}

EnvironmentsDropdown.propTypes = {
  workspaces: PropTypes.shape({
    activeId: PropTypes.string
  }),
  entities: PropTypes.shape({
    workspaces: PropTypes.object.isRequired,
    environments: PropTypes.object.isRequired
  }).isRequired
};

function mapStateToProps (state) {
  return {
    workspaces: state.workspaces,
    entities: state.entities,
    actions: state.actions
  };
}

export default connect(mapStateToProps)(EnvironmentsDropdown);
