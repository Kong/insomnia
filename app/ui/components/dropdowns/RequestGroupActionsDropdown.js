import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import PromptButton from '../base/PromptButton';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider, DropdownHint} from '../base/dropdown';
import EnvironmentEditModal from '../modals/EnvironmentEditModal';
import PromptModal from '../modals/PromptModal';
import * as models from '../../../models';
import {showModal} from '../modals';
import {trackEvent} from '../../../analytics/index';

@autobind
class RequestGroupActionsDropdown extends PureComponent {
  _setDropdownRef (n) {
    this._dropdown = n;
  }

  async _handleRename () {
    const {requestGroup} = this.props;

    const name = await showModal(PromptModal, {
      headerName: 'Rename Folder',
      defaultValue: requestGroup.name
    });

    models.requestGroup.update(requestGroup, {name});

    trackEvent('Folder', 'Rename', 'Folder Action');
  }

  async _handleRequestCreate () {
    this.props.handleCreateRequest(this.props.requestGroup._id);
    trackEvent('Request', 'Create', 'Folder Action');
  }

  _handleRequestGroupDuplicate () {
    this.props.handleDuplicateRequestGroup(this.props.requestGroup);
    trackEvent('Folder', 'Duplicate', 'Folder Action');
  }

  async _handleRequestGroupCreate () {
    this.props.handleCreateRequestGroup(this.props.requestGroup._id);
    trackEvent('Folder', 'Create', 'Folder Action');
  }

  _handleDeleteFolder () {
    models.requestGroup.remove(this.props.requestGroup);
    trackEvent('Folder', 'Delete', 'Folder Action');
  }

  _handleEditEnvironment () {
    showModal(EnvironmentEditModal, this.props.requestGroup);
  }

  show () {
    this._dropdown.show();
  }

  render () {
    const {
      requestGroup, // eslint-disable-line no-unused-vars
      ...other
    } = this.props;

    return (
      <Dropdown ref={this._setDropdownRef} {...other}>
        <DropdownButton>
          <i className="fa fa-caret-down"></i>
        </DropdownButton>
        <DropdownItem onClick={this._handleRequestCreate}>
          <i className="fa fa-plus-circle"></i> New Request
          <DropdownHint char="N"></DropdownHint>
        </DropdownItem>
        <DropdownItem onClick={this._handleRequestGroupCreate}>
          <i className="fa fa-folder"></i> New Folder
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem onClick={this._handleRequestGroupDuplicate}>
          <i className="fa fa-copy"></i> Duplicate
        </DropdownItem>
        <DropdownItem onClick={this._handleRename}>
          <i className="fa fa-edit"></i> Rename
        </DropdownItem>
        <DropdownItem onClick={this._handleEditEnvironment}>
          <i className="fa fa-code"></i> Environment
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton} addIcon onClick={this._handleDeleteFolder}>
          <i className="fa fa-trash-o"></i> Delete
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

  // Optional
  requestGroup: PropTypes.object
};

export default RequestGroupActionsDropdown;
