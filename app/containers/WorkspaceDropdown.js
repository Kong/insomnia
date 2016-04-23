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
          err || importData(data);
        })
      })
    });
  }

  render () {
    const {actions, loading, ...other} = this.props;

    return (
      <Dropdown right={true} {...other} className="block">
        <button className="btn header__content">
          <div className="grid grid--center">
            <div className="grid__cell">
              <h1 className="no-pad">Insomnia</h1>
            </div>
            <div className="no-wrap">
              {loading ? <i className="fa fa-refresh fa-spin txt-lg"></i> : ''}&nbsp;
              <i className="fa fa-caret-down txt-lg"></i>
            </div>
          </div>
        </button>
        <ul>
          
          <DropdownDivider name="Current Workspace" />
          
          <li>
            <button onClick={e => db.requestCreate()}>
              <i className="fa fa-plus-circle"></i> New Request
            </button>
          </li>
          <li>
            <button onClick={e => db.requestGroupCreate()}>
              <i className="fa fa-folder"></i> New Request Group
            </button>
          </li>
          <li>
            <button onClick={e => actions.showEnvironmentEditModal()}>
              <i className="fa fa-code"></i> Manage Environments
            </button>
          </li>
          <li>
            <button onClick={e => this._importDialog()}>
              <i className="fa fa-share-square-o"></i> Import/Export
            </button>
          </li>
          <li>
            <button>
              <i className="fa fa-empty"></i> Delete <strong>Sendwithus</strong>
            </button>
          </li>
          
          <DropdownDivider name="Workspaces" />

          <li>
            <button>
              <i className="fa fa-random"></i> Switch to <strong>Sendwithus Track</strong>
            </button>
          </li>
          <li>
            <button>
              <i className="fa fa-random"></i> Switch to <strong>Default</strong>
            </button>
          </li>
          <li>
            <button>
              <i className="fa fa-blank"></i> Create Workspace
            </button>
          </li>

          <DropdownDivider name="Insomnia" />

          <li><button><i className="fa fa-cog"></i> Settings</button></li>
          <li><button><i className="fa fa-blank"></i> Open New Window</button></li>
        </ul>
      </Dropdown>
    )
  }
}

WorkspaceDropdown.propTypes = {
  loading: PropTypes.bool.isRequired,
  actions: PropTypes.shape({
    showEnvironmentEditModal: PropTypes.func.isRequired
  })
};

function mapStateToProps (state) {
  return {
    actions: state.actions,
    loading: state.global.loading
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: bindActionCreators(RequestGroupActions, dispatch)
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(WorkspaceDropdown);
