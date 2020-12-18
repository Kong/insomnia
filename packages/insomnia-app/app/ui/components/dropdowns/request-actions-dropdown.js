import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import PromptButton from '../base/prompt-button';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHint,
  DropdownItem,
} from '../base/dropdown/index';
import { hotKeyRefs } from '../../../common/hotkeys';
import * as misc from '../../../common/misc';
import { isRequest } from '../../../models/helpers/is-model';
import * as requestOperations from '../../../models/helpers/request-operations';
import { incrementDeletedRequests } from '../../../models/stats';

@autobind
class RequestActionsDropdown extends PureComponent {
  _setDropdownRef(n) {
    this._dropdown = n;
  }

  _handleDuplicate() {
    const { request, handleDuplicateRequest } = this.props;
    handleDuplicateRequest(request);
  }

  _handleGenerateCode() {
    this.props.handleGenerateCode(this.props.request);
  }

  _handleCopyAsCurl() {
    this.props.handleCopyAsCurl(this.props.request);
  }

  _canPin() {
    return this.props.handleSetRequestPinned !== misc.nullFn;
  }

  _handleSetRequestPinned() {
    this.props.handleSetRequestPinned(this.props.request, !this.props.isPinned);
  }

  _handleRemove() {
    const { request } = this.props;

    incrementDeletedRequests();
    return requestOperations.remove(request);
  }

  show() {
    this._dropdown.show();
  }

  render() {
    const {
      request, // eslint-disable-line no-unused-vars
      handleShowSettings,
      hotKeyRegistry,
      ...other
    } = this.props;

    // Can only generate code for regular requests, not gRPC requests
    const canGenerateCode = isRequest(request);

    return (
      <Dropdown ref={this._setDropdownRef} {...other}>
        <DropdownButton>
          <i className="fa fa-caret-down" />
        </DropdownButton>

        <DropdownItem onClick={this._handleDuplicate}>
          <i className="fa fa-copy" /> Duplicate
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_DUPLICATE.id]} />
        </DropdownItem>

        {canGenerateCode && (
          <DropdownItem onClick={this._handleGenerateCode}>
            <i className="fa fa-code" /> Generate Code
            <DropdownHint
              keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_GENERATE_CODE_EDITOR.id]}
            />
          </DropdownItem>
        )}

        <DropdownItem onClick={this._handleSetRequestPinned}>
          <i className="fa fa-thumb-tack" /> {this.props.isPinned ? 'Unpin' : 'Pin'}
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_TOGGLE_PIN.id]} />
        </DropdownItem>

        {canGenerateCode && (
          <DropdownItem onClick={this._handleCopyAsCurl}>
            <i className="fa fa-copy" /> Copy as Curl
          </DropdownItem>
        )}

        <DropdownItem buttonClass={PromptButton} onClick={this._handleRemove} addIcon>
          <i className="fa fa-trash-o" /> Delete
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_DELETE.id]} />
        </DropdownItem>

        <DropdownDivider />

        <DropdownItem onClick={handleShowSettings}>
          <i className="fa fa-wrench" /> Settings
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_SETTINGS.id]} />
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
  isPinned: PropTypes.bool.isRequired,
  request: PropTypes.object.isRequired, // can be Request or GrpcRequest
  hotKeyRegistry: PropTypes.object.isRequired,
  handleSetRequestPinned: PropTypes.func.isRequired,
};

export default RequestActionsDropdown;
