import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import PromptButton from '../base/PromptButton';
import {Dropdown, DropdownHint, DropdownButton, DropdownItem} from '../base/dropdown';
import PromptModal from '../modals/PromptModal';
import * as models from '../../../models';
import {showModal} from '../modals/index';
import {trackEvent} from '../../../analytics/index';

@autobind
class RequestActionsDropdown extends PureComponent {
  constructor (props) {
    super(props);
  }
  _setDropdownRef (n) {
    this._dropdown = n;
  }

  _handleDuplicate () {
    const {request, handleDuplicateRequest} = this.props;
    handleDuplicateRequest(request);
    trackEvent('Request', 'Duplicate', 'Request Action');
  }

  _handleGenerateCode () {
    this.props.handleGenerateCode(this.props.request);
    trackEvent('Request', 'Generate Code', 'Request Action');
  }

  async _handlePromptUpdateName () {
    const {request} = this.props;

    const name = await showModal(PromptModal, {
      headerName: 'Rename Request',
      defaultValue: request.name,
      hint: 'also rename requests by double clicking in the sidebar'
    });

    models.request.update(request, {name});

    trackEvent('Request', 'Rename', 'Request Action');
  }

  _handleRemove () {
    const {request} = this.props;
    models.request.remove(request);
    trackEvent('Request', 'Delete', 'Action');
  }

  show () {
    this._dropdown.show();
  }

  render () {
    const {request, ...other} = this.props;

    return (
      <Dropdown ref={this._setDropdownRef} {...other}>
        <DropdownButton>
          <i className="fa fa-caret-down"></i>
        </DropdownButton>
        <DropdownItem onClick={this._handleDuplicate}>
          <i className="fa fa-copy"/> Duplicate
          <DropdownHint char="D"/>
        </DropdownItem>
        <DropdownItem onClick={this._handlePromptUpdateName}>
          <i className="fa fa-edit"/> Rename
        </DropdownItem>
        <DropdownItem onClick={this._handleGenerateCode}>
          <i className="fa fa-code"/> Generate Code
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton} onClick={this._handleRemove} addIcon>
          <i className="fa fa-trash-o"/> Delete
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
