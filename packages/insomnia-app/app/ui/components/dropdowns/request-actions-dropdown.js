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
import * as models from '../../../models';
import { hotKeyRefs } from '../../../common/hotkeys';

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

  _handleRemove() {
    const { request } = this.props;
    models.request.remove(request);
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

    return (
      <Dropdown ref={this._setDropdownRef} {...other}>
        <DropdownButton>
          <i className="fa fa-caret-down" />
        </DropdownButton>
        <DropdownItem onClick={this._handleDuplicate}>
          <i className="fa fa-copy" /> Duplicate
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_DUPLICATE.id]} />
        </DropdownItem>
        <DropdownItem onClick={this._handleGenerateCode}>
          <i className="fa fa-code" /> Generate Code
          <DropdownHint
            keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_GENERATE_CODE_EDITOR.id]}
          />
        </DropdownItem>
        <DropdownItem onClick={this._handleCopyAsCurl}>
          <i className="fa fa-copy" /> Copy as Curl
        </DropdownItem>
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
  request: PropTypes.object.isRequired,
  hotKeyRegistry: PropTypes.object.isRequired,
};

export default RequestActionsDropdown;
