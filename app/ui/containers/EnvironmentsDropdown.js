import React, {Component, PropTypes} from 'react';
import {ipcRenderer} from 'electron';
import {connect} from 'react-redux';
import classnames from 'classnames';

import EnvironmentsModal from '../components/modals/WorkspaceEnvironmentsEditModal';
import {Dropdown, DropdownDivider, DropdownButton, DropdownItem} from '../components/base/dropdown';
import {showModal} from '../components/modals/index';
import * as models from '../../models';


class EnvironmentsDropdown extends Component {
  _getActiveWorkspace (props) {
    // TODO: Factor this out into a selector

    const {entities, global} = props || this.props;
    let workspace = entities.workspaces[global.activeWorkspaceId];
    if (!workspace) {
      workspace = entities.workspaces[Object.keys(entities.workspaces)[0]];
    }

    return workspace;
  }

  _handleActivateEnvironment (environment) {
    const workspace = this._getActiveWorkspace();
    models.workspace.update(workspace, {metaActiveEnvironmentId: environment._id});
  }

  render () {
    const {className, entities, ...other} = this.props;
    const workspace = this._getActiveWorkspace(this.props);

    const allEnvironments = Object.keys(entities.environments).map(id => entities.environments[id]);

    // NOTE: Base environment might not exist if the users hasn't managed environments yet.
    const baseEnvironment = allEnvironments.find(e => e.parentId === workspace._id);
    const subEnvironments = allEnvironments.filter(e => e.parentId === (baseEnvironment && baseEnvironment._id));
    const activeEnvironment = allEnvironments.find(e => e._id === workspace.metaActiveEnvironmentId) || baseEnvironment;

    return (
      <Dropdown {...other} className={classnames(className, 'wide')}>
        <DropdownButton className="btn btn--super-compact no-wrap">
          <div className="sidebar__menu__thing">
            <span>
              {activeEnvironment && activeEnvironment !== baseEnvironment ? activeEnvironment.name : 'No Environment'}
              </span>
            &nbsp;
            <i className="fa fa-caret-down"></i>
          </div>
        </DropdownButton>
        <DropdownDivider name="Switch Environment"/>
        {subEnvironments.map(environment => (
          <DropdownItem key={environment._id}
                        disabled={environment._id === activeEnvironment._id}
                        onClick={() => this._handleActivateEnvironment(environment)}>
            <i className="fa fa-random"></i> Use <strong>{environment.name}</strong>
          </DropdownItem>
        ))}
        <DropdownItem disabled={!activeEnvironment || activeEnvironment._id === baseEnvironment._id}
                        onClick={() => baseEnvironment && this._handleActivateEnvironment(baseEnvironment)}>
          <i className="fa fa-empty"></i> No Environment
        </DropdownItem>
        <DropdownDivider name="General"/>
        <DropdownItem onClick={e => showModal(EnvironmentsModal, workspace)}>
          <i className="fa fa-wrench"></i> Manage Environments
        </DropdownItem>
      </Dropdown>
    )
  }
}

EnvironmentsDropdown.propTypes = {
  global: PropTypes.shape({
    activeWorkspaceId: PropTypes.string
  }),
  entities: PropTypes.shape({
    workspaces: PropTypes.object.isRequired,
    environments: PropTypes.object.isRequired
  }).isRequired
};

function mapStateToProps (state) {
  return {
    global: state.global,
    entities: state.entities,
    actions: state.actions
  };
}

export default connect(mapStateToProps)(EnvironmentsDropdown);
