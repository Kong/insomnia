import React, {Component, PropTypes} from 'react';
import PromptButton from '../base/PromptButton';
import {Dropdown, DropdownHint, DropdownButton, DropdownItem} from '../base/dropdown';
import PromptModal from '../modals/PromptModal';
import * as models from '../../../models';
import {showModal} from '../modals/index';
import {trackEvent} from '../../../analytics/index';
import AlertModal from '../modals/AlertModal';
import {MOD_SYM} from '../../../common/constants';


class RequestActionsDropdown extends Component {
  _handleDuplicate = () => {
    const {request, handleDuplicateRequest} = this.props;
    handleDuplicateRequest(request);
    trackEvent('Request', 'Duplicate', 'Request Action');
  };

  _handleGenerateCode = () => {
    this.props.handleGenerateCode(this.props.request);
    trackEvent('Request', 'Generate Code', 'Request Action');
  };

  _handleAdvancedSend = () => {
    trackEvent('Request', 'Advanced Send Hint', 'Request Action');
    showModal(AlertModal, {
      title: 'Advanced Sending',
      message: (
        <div>
          For advanced sending options, hold <code>{MOD_SYM}</code> while
          clicking the send button next to the Url.
        </div>
      )
    });
  };

  _handlePromptUpdateName = async () => {
    const {request} = this.props;

    const name = await showModal(PromptModal, {
      headerName: 'Rename Request',
      defaultValue: request.name,
      hint: 'also rename requests by double clicking in the sidebar'
    });

    models.request.update(request, {name});

    trackEvent('Request', 'Rename', 'Request Action');
  };

  _handleRemove = () => {
    const {request} = this.props;
    models.request.remove(request);
    trackEvent('Request', 'Delete', 'Action');
  };

  render () {
    const {request, ...other} = this.props;

    return (
      <Dropdown {...other}>
        <DropdownButton>
          <i className="fa fa-caret-down"></i>
        </DropdownButton>
        <DropdownItem onClick={this._handleDuplicate}>
          <i className="fa fa-copy"></i> Duplicate
          <DropdownHint char="D"></DropdownHint>
        </DropdownItem>
        <DropdownItem onClick={this._handlePromptUpdateName}>
          <i className="fa fa-edit"></i> Rename
        </DropdownItem>
        <DropdownItem onClick={this._handleGenerateCode}>
          <i className="fa fa-code"></i> Generate Code
        </DropdownItem>
        <DropdownItem onClick={this._handleAdvancedSend}>
          <i className="fa fa-refresh"></i> Advanced Sending
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton} onClick={this._handleRemove} addIcon={true}>
          <i className="fa fa-trash-o"></i> Delete
        </DropdownItem>
      </Dropdown>
    )
  }
}

RequestActionsDropdown.propTypes = {
  handleDuplicateRequest: PropTypes.func.isRequired,
  handleGenerateCode: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,
};

export default RequestActionsDropdown;
