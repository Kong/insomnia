// @flow
import * as React from 'react';
import {AUTH_ASAP, AUTH_AWS_IAM, AUTH_BASIC, AUTH_BEARER, AUTH_DIGEST, AUTH_HAWK, AUTH_NETRC, AUTH_NTLM, AUTH_OAUTH_1, AUTH_OAUTH_2, getAuthTypeName} from '../../../../common/constants';
import BasicAuth from './basic-auth';
import DigestAuth from './digest-auth';
import BearerAuth from './bearer-auth';
import NTLMAuth from './ntlm-auth';
import OAuth2Auth from './o-auth-2-auth';
import OAuth1Auth from './o-auth-1-auth';
import HawkAuth from './hawk-auth';
import AWSAuth from './aws-auth';
import NetrcAuth from './netrc-auth';
import AsapAuth from './asap-auth';
import autobind from 'autobind-decorator';
import type {Request, RequestAuthentication} from '../../../../models/request';
import type {OAuth2Token} from '../../../../models/o-auth-2-token';

type Props = {
  handleRender: Function,
  handleGetRenderContext: Function,
  handleUpdateSettingsShowPasswords: Function,
  handleUpdateAuthenticationDisableInheritance: Function,
  nunjucksPowerUserMode: boolean,
  onChange: Function,
  request: Request,
  showPasswords: boolean,
  inheritedAuthentication: RequestAuthentication | null,
  oAuth2Token: OAuth2Token | null
};

@autobind
class AuthWrapper extends React.PureComponent<Props> {
  _handleUpdateAuthenticationDisableInheritance (e: SyntheticEvent<HTMLInputElement>) {
    this.props.handleUpdateAuthenticationDisableInheritance(!e.currentTarget.checked);
  }

  renderEditor () {
    const {
      oAuth2Token,
      request,
      inheritedAuthentication,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      handleUpdateSettingsShowPasswords,
      onChange,
      showPasswords
    } = this.props;

    const {authentication} = request;

    if (authentication.type === AUTH_BASIC) {
      return (
        <BasicAuth
          authentication={authentication}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
          showPasswords={showPasswords}
        />
      );
    } else if (authentication.type === AUTH_OAUTH_2) {
      return (
        <OAuth2Auth
          oAuth2Token={oAuth2Token}
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          onChange={onChange}
          showPasswords={showPasswords}
        />
      );
    } else if (authentication.type === AUTH_HAWK) {
      return (
        <HawkAuth
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
        />
      );
    } else if (authentication.type === AUTH_OAUTH_1) {
      return (
        <OAuth1Auth
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
        />
      );
    } else if (authentication.type === AUTH_DIGEST) {
      return (
        <DigestAuth
          authentication={authentication}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
          showPasswords={showPasswords}
        />
      );
    } else if (authentication.type === AUTH_NTLM) {
      return (
        <NTLMAuth
          authentication={authentication}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          onChange={onChange}
          showPasswords={showPasswords}
        />
      );
    } else if (authentication.type === AUTH_BEARER) {
      return (
        <BearerAuth
          authentication={authentication}
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
        />
      );
    } else if (authentication.type === AUTH_AWS_IAM) {
      return (
        <AWSAuth
          authentication={authentication}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
          showPasswords={showPasswords}
        />
      );
    } else if (authentication.type === AUTH_NETRC) {
      return (
        <NetrcAuth/>
      );
    } else if (authentication.type === AUTH_ASAP) {
      return (
        <AsapAuth
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
        />
      );
    } else if (inheritedAuthentication) {
      return (
        <div className="vertically-center text-center">
          <div className="pad super-faint text-sm text-center">
            <i className="fa fa-unlock-alt" style={{fontSize: '8rem', opacity: 0.3}}/>
            <br/><br/>
            <div className="form-control">
              <label>
                <input
                  type="checkbox"
                  checked={!request.authentication.disableInheritance}
                  onChange={this._handleUpdateAuthenticationDisableInheritance}
                />
                Inherit {getAuthTypeName(inheritedAuthentication.type, true) || 'Auth'} from parent
              </label>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="vertically-center text-center">
          <p className="pad super-faint text-sm text-center">
            <i className="fa fa-unlock-alt" style={{fontSize: '8rem', opacity: 0.3}}/>
            <br/><br/>
            Select an auth type from above
          </p>
        </div>
      );
    }
  }

  render () {
    return (
      <div className="tall">{this.renderEditor()}</div>
    );
  }
}

export default AuthWrapper;
