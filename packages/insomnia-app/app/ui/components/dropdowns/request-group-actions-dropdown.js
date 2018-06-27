import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import PromptButton from '../base/prompt-button';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHint,
  DropdownItem
} from '../base/dropdown';
import EnvironmentEditModal from '../modals/environment-edit-modal';
import * as models from '../../../models';
import { showPrompt, showModal } from '../modals/index';
import * as hotkeys from '../../../common/hotkeys';

@autobind
class RequestGroupActionsDropdown extends PureComponent {
  _setDropdownRef(n) {
    this._dropdown = n;
  }

  _handleRename() {
    const { requestGroup } = this.props;

    showPrompt({
      title: 'Rename Folder',
      defaultValue: requestGroup.name,
      onComplete: name => {
        models.requestGroup.update(requestGroup, { name });
      }
    });
  }

  async _handleRequestCreate() {
    this.props.handleCreateRequest(this.props.requestGroup._id);
  }

  _handleRequestGroupDuplicate() {
    this.props.handleDuplicateRequestGroup(this.props.requestGroup);
  }

  _handleRequestGroupMove() {
    this.props.handleMoveRequestGroup(this.props.requestGroup);
  }

  async _handleRequestGroupCreate() {
    this.props.handleCreateRequestGroup(this.props.requestGroup._id);
  }

  _handleDeleteFolder() {
    models.requestGroup.remove(this.props.requestGroup);
  }

  _handleEditEnvironment() {
    showModal(EnvironmentEditModal, this.props.requestGroup);
  }

  show() {
    this._dropdown.show();
  }

  render() {
    const {
      requestGroup, // eslint-disable-line no-unused-vars
      ...other
    } = this.props;

    return (
      <Dropdown ref={this._setDropdownRef} {...other}>
        <DropdownButton>
          <i className="fa fa-caret-down" />
        </DropdownButton>
        <DropdownItem onClick={this._handleRequestCreate}>
          <i className="fa fa-plus-circle" /> New Request
          <DropdownHint hotkey={hotkeys.CREATE_REQUEST} />
        </DropdownItem>
        <DropdownItem onClick={this._handleRequestGroupCreate}>
          <i className="fa fa-folder" /> New Folder
          <DropdownHint hotkey={hotkeys.CREATE_FOLDER} />
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem onClick={this._handleRequestGroupDuplicate}>
          <i className="fa fa-copy" /> Duplicate
        </DropdownItem>
        <DropdownItem onClick={this._handleRename}>
          <i className="fa fa-edit" /> Rename
        </DropdownItem>
        <DropdownItem onClick={this._handleEditEnvironment}>
          <i className="fa fa-code" /> Environment
        </DropdownItem>
        <DropdownItem onClick={this._handleRequestGroupMove}>
          <i className="fa fa-exchange" /> Move
        </DropdownItem>
        <DropdownItem
          buttonClass={PromptButton}
          addIcon
          onClick={this._handleDeleteFolder}>
          <i className="fa fa-trash-o" /> Delete
        </DropdownItem>
      </Dropdown>
    );
  }
}

RequestGroupActionsDropdown.propTypes = {
  workspace: PropTypes.object.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  handleCreateRequestGroup: PropTypes.func.isRequired,
  handleDuplicateRequestGroup: PropTypes.func.isRequired,
  handleMoveRequestGroup: PropTypes.func.isRequired,

  // Optional
  requestGroup: PropTypes.object
};

export default RequestGroupActionsDropdown;
