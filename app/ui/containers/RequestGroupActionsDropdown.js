import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import PromptButton from '../components/base/PromptButton';
import Dropdown from '../components/base/Dropdown';
import DropdownHint from '../components/base/DropdownHint';
import DropdownDivider from '../components/base/DropdownDivider';
import EnvironmentEditModal from '../components/modals/EnvironmentEditModal';
import PromptModal from '../components/modals/PromptModal';
import * as db from 'backend/database';
import {getModal} from '../components/modals/index';

class RequestGroupActionsDropdown extends Component {
  _promptUpdateName () {
    const {requestGroup} = this.props;

    getModal(PromptModal).show({
      headerName: 'Rename Folder',
      defaultValue: requestGroup.name
    }).then(name => {
      db.requestGroupUpdate(requestGroup, {name});
    })
  }

  _requestCreate () {
    getModal(PromptModal).show({
      headerName: 'Create New Request',
      defaultValue: 'My Request',
      selectText: true
    }).then(name => {
      const workspace = this._getActiveWorkspace();
      const {requestGroup} = this.props;
      const parentId = requestGroup._id;
      db.requestCreateAndActivate(workspace, {parentId, name})
    });
  }

  _requestGroupDuplicate () {
    const {requestGroup} = this.props;
    db.requestGroupDuplicate(requestGroup)
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
            <button onClick={e => this._requestCreate()}>
              <i className="fa fa-plus-circle"></i> New Request
              <DropdownHint char="N"></DropdownHint>
            </button>
          </li>
          <DropdownDivider />
          <li>
            <button onClick={e => this._requestGroupDuplicate()}>
              <i className="fa fa-copy"></i> Duplicate
            </button>
          </li>
          <li>
            <button onClick={e => this._promptUpdateName()}>
              <i className="fa fa-edit"></i> Rename
            </button>
          </li>
          <li>
            <button
              onClick={e => getModal(EnvironmentEditModal).show(requestGroup)}>
              <i className="fa fa-code"></i> Environment
            </button>
          </li>
          <li>
            <PromptButton onClick={e => db.requestGroupRemove(requestGroup)}
                          addIcon={true}>
              <i className="fa fa-trash-o"></i> Delete
            </PromptButton>
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
