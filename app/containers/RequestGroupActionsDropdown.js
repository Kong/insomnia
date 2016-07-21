import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux'
import Dropdown from '../components/base/Dropdown';
import EnvironmentEditModal from '../components/EnvironmentEditModal';
import PromptModal from '../components/PromptModal';
import * as db from '../database';

class RequestGroupActionsDropdown extends Component {
  _promptUpdateName () {
    const {requestGroup} = this.props;

    PromptModal.show({
      headerName: 'Rename Folder',
      defaultValue: requestGroup.name
    }).then(name => {
      db.requestGroupUpdate(requestGroup, {name});
    })
  }

  _requestCreate () {
    const workspace = this._getActiveWorkspace(this.props);
    const {requestGroup} = this.props;
    db.requestCreateAndActivate(workspace, {parentId: requestGroup._id});
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
    const {requestGroup, ...other} = this.props;

    return (
      <Dropdown {...other}>
        <button>
          <i className="fa fa-caret-down"></i>
        </button>
        <ul>
          <li>
            <button onClick={e => EnvironmentEditModal.show()}>
              <i className="fa fa-code"></i> Environment
            </button>
          </li>
          <li>
            <button onClick={e => this._promptUpdateName()}>
              <i className="fa fa-edit"></i> Rename
            </button>
          </li>
          <li>
            <button onClick={e => this._requestCreate()}>
              <i className="fa fa-plus-circle"></i> New Request
            </button>
          </li>
          {/*<li>*/}
          {/*<button onClick={e => db.requestGroupCreate({parentId: requestGroup._id})}>*/}
          {/*<i className="fa fa-folder"></i> New Folder*/}
          {/*</button>*/}
          {/*</li>*/}
          <li>
            <button onClick={e => db.requestGroupRemove(requestGroup)}>
              <i className="fa fa-trash-o"></i> Delete Group
            </button>
          </li>
        </ul>
      </Dropdown>
    )
  }
}

RequestGroupActionsDropdown.propTypes = {
  // Required
  entities: PropTypes.shape({
    workspaces: PropTypes.object.isRequired
  }).isRequired,
  workspaces: PropTypes.shape({
    activeId: PropTypes.string
  }),

  // Optional
  requestGroup: PropTypes.object
};

function mapStateToProps (state) {
  return {
    workspaces: state.workspaces,
    entities: state.entities
  };
}

function mapDispatchToProps (dispatch) {
  return {}
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RequestGroupActionsDropdown);
