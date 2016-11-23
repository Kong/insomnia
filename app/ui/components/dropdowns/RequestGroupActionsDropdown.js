import React, {Component, PropTypes} from 'react';
import PromptButton from '../base/PromptButton';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider, DropdownHint} from '../base/dropdown';
import EnvironmentEditModal from '../modals/EnvironmentEditModal';
import PromptModal from '../modals/PromptModal';
import * as models from '../../../models';
import {showModal} from '../modals';
import {trackEvent} from '../../../analytics/index';

class RequestGroupActionsDropdown extends Component {
  async _promptUpdateName () {
    const {requestGroup} = this.props;

    const name = await showModal(PromptModal, {
      headerName: 'Rename Folder',
      defaultValue: requestGroup.name
    });

    models.requestGroup.update(requestGroup, {name});

    trackEvent('Folder', 'Rename', 'Folder Action');
  }

  async _requestCreate () {
    this.props.handleCreateRequest();
    trackEvent('Request', 'Create', 'Folder Action');
  }

  _requestGroupDuplicate () {
    const {requestGroup} = this.props;
    models.requestGroup.duplicate(requestGroup);
    trackEvent('Folder', 'Duplicate', 'Folder Action');
  }

  async _requestGroupCreate () {
    this.props.handleCreateRequestGroup();
    trackEvent('Folder', 'Create', 'Folder Action');
  }

  render () {
    const {requestGroup, ...other} = this.props;

    return (
      <Dropdown {...other}>
        <DropdownButton>
          <i className="fa fa-caret-down"></i>
        </DropdownButton>
        <DropdownItem onClick={e => this._requestCreate()}>
          <i className="fa fa-plus-circle"></i> New Request
          <DropdownHint char="N"></DropdownHint>
        </DropdownItem>
        <DropdownItem onClick={e => this._requestGroupCreate()}>
          <i className="fa fa-folder"></i> New Folder
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem onClick={e => this._requestGroupDuplicate()}>
          <i className="fa fa-copy"></i> Duplicate
        </DropdownItem>
        <DropdownItem onClick={e => this._promptUpdateName()}>
          <i className="fa fa-edit"></i> Rename
        </DropdownItem>
        <DropdownItem
          onClick={e => showModal(EnvironmentEditModal, requestGroup)}>
          <i className="fa fa-code"></i> Environment
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton} addIcon={true} onClick={e => {
          models.requestGroup.remove(requestGroup);
          trackEvent('Folder', 'Delete', 'Folder Action');
        }}>
          <i className="fa fa-trash-o"></i> Delete
        </DropdownItem>
      </Dropdown>
    )
  }
}

RequestGroupActionsDropdown.propTypes = {
  workspace: PropTypes.object.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  handleCreateRequestGroup: PropTypes.func.isRequired,

  // Optional
  requestGroup: PropTypes.object
};

export default RequestGroupActionsDropdown;
