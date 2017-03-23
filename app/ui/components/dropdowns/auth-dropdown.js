import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider} from '../base/dropdown';
import {trackEvent} from '../../../analytics';
import {showModal} from '../modals';
import AlertModal from '../modals/alert-modal';
import * as models from '../../../models';
import {AUTH_BASIC, AUTH_DIGEST, AUTH_NONE, AUTH_OAUTH_1, AUTH_OAUTH_2, getAuthTypeName} from '../../../common/constants';

@autobind
class AuthDropdown extends PureComponent {
  async _handleTypeChange (type) {
    if (type === this.props.authentication.type) {
      // Type didn't change
      return;
    }

    const newAuthentication = models.request.newAuth(type);
    const defaultAuthentication = models.request.newAuth(this.props.authentication.type);

    // Prompt the user if they have edited the auth away from the default settings
    for (const key of Object.keys(this.props.authentication)) {
      const value = this.props.authentication[key];
      if (defaultAuthentication[key] !== value) {
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
        <DropdownButton className={className}>
          {children}
        </DropdownButton>
        <DropdownItem onClick={this._handleTypeChange} value={AUTH_BASIC}>
          {getAuthTypeName(AUTH_BASIC, true)}
        </DropdownItem>
        <DropdownItem onClick={this._handleTypeChange} value={AUTH_DIGEST}>
          {getAuthTypeName(AUTH_DIGEST, true)}
        </DropdownItem>
        <DropdownItem onClick={this._handleTypeChange} value={AUTH_OAUTH_1}>
          {getAuthTypeName(AUTH_OAUTH_1, true)}
        </DropdownItem>
        <DropdownItem onClick={this._handleTypeChange} value={AUTH_OAUTH_2}>
          {getAuthTypeName(AUTH_OAUTH_2, true)}
        </DropdownItem>
        <DropdownDivider/>
        <DropdownItem onClick={this._handleTypeChange} value={AUTH_NONE}>
          {getAuthTypeName(AUTH_NONE, true)}
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
