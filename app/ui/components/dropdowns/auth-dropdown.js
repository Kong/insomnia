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
    const defaultAuthentication = models.request.newAuth(this.props.authentication.type);

    // Prompt the user if fields will change between new and old
    for (const key of Object.keys(this.props.authentication)) {
      if (key === 'type') {
        continue;
      }

      const value = this.props.authentication[key];
      const changedSinceDefault = defaultAuthentication[key] !== value;
      const willChange = newAuthentication[key] !== value;

      if (changedSinceDefault && willChange) {
        await showModal(AlertModal, {
          title: 'Switch Authentication?',
          message: 'Current authentication settings will be lost',
          addCancel: true
        });
        break;
      }
    }

    trackEvent('Request', 'Auth Type Change', newAuthentication.type);
    this.props.onChange(newAuthentication);
  }

  renderAuthType (type, nameOverride = null) {
    const currentType = this.props.authentication.type || AUTH_NONE;
    return (
      <DropdownItem onClick={this._handleTypeChange} value={type}>
        {currentType === type ? <i className="fa fa-check"/> : <i className="fa fa-empty"/>}
        {' '}
        {nameOverride || getAuthTypeName(type, true)}
      </DropdownItem>
    );
  }

  render () {
    const {children, className} = this.props;
    return (
      <Dropdown debug="true">
        <DropdownDivider>Auth Types</DropdownDivider>
        <DropdownButton className={className}>
          {children}
        </DropdownButton>
        {this.renderAuthType(AUTH_BASIC)}
        {this.renderAuthType(AUTH_OAUTH_1)}
        {this.renderAuthType(AUTH_OAUTH_2)}
        {this.renderAuthType(AUTH_DIGEST)}
        {this.renderAuthType(AUTH_NTLM)}
        <DropdownDivider>Other</DropdownDivider>
        {this.renderAuthType(AUTH_NONE, 'No Authentication')}
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
