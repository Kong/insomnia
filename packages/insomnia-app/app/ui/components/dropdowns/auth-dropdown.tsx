import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent, ReactNode } from 'react';

import {
  AUTH_ASAP,
  AUTH_AWS_IAM,
  AUTH_BASIC,
  AUTH_BEARER,
  AUTH_DIGEST,
  AUTH_HAWK,
  AUTH_NETRC,
  AUTH_NONE,
  AUTH_NTLM,
  AUTH_OAUTH_1,
  AUTH_OAUTH_2,
  AUTOBIND_CFG,
  getAuthTypeName,
} from '../../../common/constants';
import * as models from '../../../models';
import type { Request, RequestAuthentication } from '../../../models/request';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { showModal } from '../modals';
import AlertModal from '../modals/alert-modal';

interface Props {
  onChange: (r: Request, arg1: RequestAuthentication) => Promise<Request>;
  request: Request;
  className?: string;
  children?: ReactNode;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class AuthDropdown extends PureComponent<Props> {
  async _handleTypeChange(type: string) {
    const { request, onChange } = this.props;
    const { authentication } = request;

    if (type === authentication.type) {
      // Type didn't change
      return;
    }

    const newAuthentication = models.request.newAuth(type, authentication);
    const defaultAuthentication = models.request.newAuth(authentication.type);

    // Prompt the user if fields will change between new and old
    for (const key of Object.keys(authentication)) {
      if (key === 'type') {
        continue;
      }

      const value = authentication[key];
      const changedSinceDefault = defaultAuthentication[key] !== value;
      const willChange = newAuthentication[key] !== value;

      if (changedSinceDefault && willChange) {
        await showModal(AlertModal, {
          title: 'Switch Authentication?',
          message: 'Current authentication settings will be lost',
          addCancel: true,
        });
        break;
      }
    }

    onChange(request, newAuthentication);
  }

  renderAuthType(type: string, nameOverride: string | null = null) {
    const { authentication } = this.props.request;
    const currentType = authentication.type || AUTH_NONE;
    return (
      <DropdownItem onClick={this._handleTypeChange} value={type}>
        {currentType === type ? <i className="fa fa-check" /> : <i className="fa fa-empty" />}{' '}
        {nameOverride || getAuthTypeName(type, true)}
      </DropdownItem>
    );
  }

  render() {
    const { children, className } = this.props;
    return (
      <Dropdown
        beside
        // @ts-expect-error -- TSCONVERSION appears to be genuine
        debug="true"
      >
        <DropdownDivider>Auth Types</DropdownDivider>
        <DropdownButton className={className}>{children}</DropdownButton>
        {this.renderAuthType(AUTH_BASIC)}
        {this.renderAuthType(AUTH_DIGEST)}
        {this.renderAuthType(AUTH_OAUTH_1)}
        {this.renderAuthType(AUTH_OAUTH_2)}
        {this.renderAuthType(AUTH_NTLM)}
        {this.renderAuthType(AUTH_AWS_IAM)}
        {this.renderAuthType(AUTH_BEARER)}
        {this.renderAuthType(AUTH_HAWK)}
        {this.renderAuthType(AUTH_ASAP)}
        {this.renderAuthType(AUTH_NETRC)}
        <DropdownDivider>Other</DropdownDivider>
        {this.renderAuthType(AUTH_NONE, 'No Authentication')}
      </Dropdown>
    );
  }
}

export default AuthDropdown;
