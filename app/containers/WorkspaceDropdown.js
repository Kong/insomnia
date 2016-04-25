import fs from 'fs'
import electron from 'electron'

import React, {Component, PropTypes} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

import Dropdown from '../components/base/Dropdown'
import DropdownDivider from '../components/base/DropdownDivider'
import * as RequestGroupActions from '../redux/modules/requestGroups'
import * as db from '../database'
import importData from '../lib/import'

class WorkspaceDropdown extends Component {
  _importDialog () {
    const options = {
      properties: ['openFile'],
      filters: [{
        name: 'Insomnia Imports', extensions: ['json']
      }]
    };

    electron.remote.dialog.showOpenDialog(options, paths => {
      paths.map(path => {
        fs.readFile(path, 'utf8', (err, data) => {
          err || importData(this.props.workspaces.active, data);
        })
      })
    });
  }

  render () {
    const {actions, loading, workspaces, entities, ...other} = this.props;

    const allWorkspaces = Object.keys(entities.workspaces).map(id => entities.workspaces[id]);

    return (
      <Dropdown right={true} {...other} className="block">
        <button className="btn header__content">
          <div className="grid grid--center">
            <div className="grid__cell">
              <h1 className="no-pad">{workspaces.active.name}</h1>
            </div>
            <div className="no-wrap">
              {loading ? <i className="fa fa-refresh fa-spin txt-lg"></i> : ''}&nbsp;
              <i className="fa fa-caret-down txt-lg"></i>
            </div>
          </div>
        </button>
        <ul>

          <DropdownDivider name="Current Workspace"/>

          <li>
            <button onClick={e => db.requestCreate({parentId: workspaces.active._id})}>
              <i className="fa fa-plus-circle"></i> New Request
            </button>
          </li>
          <li>
            <button onClick={e => db.requestGroupCreate({parentId: workspaces.active._id})}>
              <i className="fa fa-folder"></i> New Request Group
            </button>
          </li>
          <li>
            <button onClick={e => actions.requestGroups.showEnvironmentEditModal()}>
              <i className="fa fa-code"></i> Manage Environments
            </button>
          </li>
          <li>
            <button onClick={e => this._importDialog()}>
              <i className="fa fa-share-square-o"></i> Import/Export
            </button>
          </li>
          <li>
            <button onClick={e => db.remove(workspaces.active)}>
              <i className="fa fa-empty"></i> Delete <strong>{workspaces.active.name}</strong>
            </button>
          </li>

          <DropdownDivider name="Workspaces"/>

          {allWorkspaces.map(w => {
            return w._id === workspaces.active._id ? null : (
              <li key={w._id}>
                <button onClick={() => db.workspaceActivate(w)}>
                  <i className="fa fa-random"></i> Switch to <strong>{w.name}</strong>
                </button>
              </li>
            )
          })}
          <li>
            <button onClick={e => db.workspaceCreate()}>
              <i className="fa fa-blank"></i> Create Workspace
            </button>
          </li>

          <DropdownDivider name="Insomnia"/>

          <li><button><i className="fa fa-cog"></i> Settings</button></li>
          <li><button><i className="fa fa-blank"></i> Open New Window</button></li>
        </ul>
      </Dropdown>
    )
  }
}

WorkspaceDropdown.propTypes = {
  loading: PropTypes.bool.isRequired,
  workspaces: PropTypes.shape({
    active: PropTypes.object.isRequired
  }),
  entities: PropTypes.shape({
    workspaces: PropTypes.object.isRequired
  }).isRequired,
  actions: PropTypes.shape({
    requestGroups: PropTypes.shape({
      showEnvironmentEditModal: PropTypes.func.isRequired
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
      requestGroups: bindActionCreators(RequestGroupActions, dispatch)
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(WorkspaceDropdown);
