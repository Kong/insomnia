import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import PromptButton from '../base/prompt-button';
import {Dropdown, DropdownButton, DropdownHint, DropdownItem} from '../base/dropdown';
import * as models from '../../../models';
import {trackEvent} from '../../../analytics/index';
import {DropdownDivider} from '../base/dropdown/index';

@autobind
class RequestActionsDropdown extends PureComponent {
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

  _handleCopyAsCurl () {
    trackEvent('Request', 'Copy As Curl', 'Request Action');
    this.props.handleCopyAsCurl(this.props.request);
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
    const {
      request, // eslint-disable-line no-unused-vars
      handleShowSettings,
      ...other
    } = this.props;

    return (
      <Dropdown ref={this._setDropdownRef} {...other}>
        <DropdownButton>
          <i className="fa fa-caret-down"/>
        </DropdownButton>
        <DropdownItem onClick={this._handleDuplicate}>
          <i className="fa fa-copy"/> Duplicate
          <DropdownHint char="D"/>
        </DropdownItem>
        <DropdownItem onClick={this._handleGenerateCode}>
          <i className="fa fa-code"/> Generate Code
        </DropdownItem>
        <DropdownItem onClick={this._handleCopyAsCurl}
                      buttonClass={PromptButton}
                      addIcon
                      confirmMessage="Click Again to Copy">
          <i className="fa fa-copy"/> Copy as Curl
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton} onClick={this._handleRemove} addIcon>
          <i className="fa fa-trash-o"/> Delete
        </DropdownItem>

        <DropdownDivider/>

        <DropdownItem onClick={handleShowSettings}>
          <i className="fa fa-wrench"/> Settings
          <DropdownHint alt shift char=","/>
        </DropdownItem>
      </Dropdown>
    );
  }
}

RequestActionsDropdown.propTypes = {
  handleDuplicateRequest: PropTypes.func.isRequired,
  handleGenerateCode: PropTypes.func.isRequired,
  handleCopyAsCurl: PropTypes.func.isRequired,
  handleShowSettings: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired
};

export default RequestActionsDropdown;
