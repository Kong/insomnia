import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownDivider, DropdownItem} from '../base/dropdown';
import {trackEvent} from '../../../analytics';
import {showModal} from '../modals';
import AlertModal from '../modals/alert-modal';
import * as models from '../../../models';
import {AUTH_BASIC, AUTH_DIGEST, AUTH_NONE, AUTH_NTLM, AUTH_OAUTH_1, AUTH_OAUTH_2, getAuthTypeName} from '../../../common/constants';

@autobind
class AuthDropdown extends PureComponent {
  async _handleTypeChange (type) {
    if (type === this.props.authentication.type) {
      // Type didn't change
      return;
    }

    const newAuthentication = models.request.newAuth(type, this.props.authentication);
    // const defaultAuthentication = models.request.newAuth(type, this.props.authentication);

    // Prompt the user if fields will change between new and old
    for (const key of Object.keys(this.props.authentication)) {
      const value = this.props.authentication[key];
      if (key !== 'type' && newAuthentication[key] !== value) {
        await showModal(AlertModal, {
          title: 'Switch Authentication Mode',
          message: 'Your current authentication settings will be lost. Are you sure you want to switch?',
          addCancel: true
        });
        break;
      }
    }

    trackEvent('Request', 'Auth Type Change', newAuthentication.type);
    this.props.onChange(newAuthentication);
  }

  render () {
    const {children, className, ...extraProps} = this.props;
    return (
      <Dropdown debug="true" {...extraProps}>
        <DropdownItem onClick={this._handleTypeChange} value={AUTH_NONE}>
          {getAuthTypeName(AUTH_NONE, true)}
        </DropdownItem>

        <DropdownDivider/>

        <DropdownButton className={className}>
          {children}
        </DropdownButton>
        <DropdownItem onClick={this._handleTypeChange} value={AUTH_BASIC}>
          {getAuthTypeName(AUTH_BASIC, true)}
        </DropdownItem>
        <DropdownItem onClick={this._handleTypeChange} value={AUTH_OAUTH_1}>
          {getAuthTypeName(AUTH_OAUTH_1, true)}
        </DropdownItem>
        <DropdownItem onClick={this._handleTypeChange} value={AUTH_OAUTH_2}>
          {getAuthTypeName(AUTH_OAUTH_2, true)}
        </DropdownItem>
        <DropdownItem onClick={this._handleTypeChange} value={AUTH_DIGEST}>
          {getAuthTypeName(AUTH_DIGEST, true)}
        </DropdownItem>
        <DropdownItem onClick={this._handleTypeChange} value={AUTH_NTLM}>
          {getAuthTypeName(AUTH_NTLM, true)}
        </DropdownItem>
      </Dropdown>
    );
  }
}

AuthDropdown.propTypes = {
  onChange: PropTypes.func.isRequired,
  authentication: PropTypes.object.isRequired,

  // Optional
  className: PropTypes.string,
  children: PropTypes.node
};

export default AuthDropdown;
