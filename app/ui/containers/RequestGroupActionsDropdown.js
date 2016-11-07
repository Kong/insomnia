import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import PromptButton from '../components/base/PromptButton';
import Dropdown from '../components/base/Dropdown';
import DropdownHint from '../components/base/DropdownHint';
import DropdownDivider from '../components/base/DropdownDivider';
import EnvironmentEditModal from '../components/modals/EnvironmentEditModal';
import PromptModal from '../components/modals/PromptModal';
import * as globalActions from '../redux/modules/global';
import * as db from '../../backend/database';
import {showModal} from '../components/modals/index';

class RequestGroupActionsDropdown extends Component {
  async _promptUpdateName () {
    const {requestGroup} = this.props;

    const name = await showModal(PromptModal, {
      headerName: 'Rename Folder',
      defaultValue: requestGroup.name
    });

    db.requestGroup.update(requestGroup, {name});
  }

  async _requestCreate () {
    const name = await showModal(PromptModal, {
      headerName: 'Create New Request',
      defaultValue: 'My Request',
      selectText: true
    });

    const workspace = this._getActiveWorkspace();
    const {requestGroup} = this.props;
    const parentId = requestGroup._id;
    const request = await db.request.create({parentId, name});
    this.props.actions.global.activateRequest(workspace, request);
  }

  _requestGroupDuplicate () {
    const {requestGroup} = this.props;
    db.requestGroup.duplicate(requestGroup);
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
              onClick={e => showModal(EnvironmentEditModal, requestGroup)}>
              <i className="fa fa-code"></i> Environment
            </button>
          </li>
          <li>
            <PromptButton onClick={e => db.requestGroup.remove(requestGroup)}
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

  actions: PropTypes.shape({
    global: PropTypes.shape({
      activateRequest: PropTypes.func.isRequired
    }).isRequired,
  }),

  global: PropTypes.shape({
    activeWorkspaceId: PropTypes.string
  }),

  // Optional
  requestGroup: PropTypes.object
};

function mapStateToProps (state) {
  return {
    global: state.global,
    entities: state.entities
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: {
      global: bindActionCreators(globalActions, dispatch)
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RequestGroupActionsDropdown);
