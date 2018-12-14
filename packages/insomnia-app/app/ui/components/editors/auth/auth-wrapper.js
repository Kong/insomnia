// @flow

import * as React from 'react';
import {
  AUTH_BASIC,
  AUTH_DIGEST,
  AUTH_BEARER,
  AUTH_NTLM,
  AUTH_OAUTH_1,
  AUTH_OAUTH_2,
  AUTH_AWS_IAM,
  AUTH_HAWK,
  AUTH_NETRC,
  AUTH_ASAP,
} from '../../../../common/constants';
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
import type { Request, RequestAuthentication } from '../../../../models/request';
import type { OAuth2Token } from '../../../../models/o-auth-2-token';
import type { Settings } from '../../../../models/settings';

type Props = {
  handleRender: Function,
  handleGetRenderContext: Function,
  handleUpdateSettingsShowPasswords: (showPasswords: boolean) => Promise<Settings>,
  nunjucksPowerUserMode: boolean,
  onChange: (Request, RequestAuthentication) => Promise<Request>,
  request: Request,
  showPasswords: boolean,
  isVariableUncovered: boolean,

  // Optional
  oAuth2Token: ?OAuth2Token,
};

@autobind
class AuthWrapper extends React.PureComponent<Props> {
  renderEditor() {
    const {
      oAuth2Token,
      request,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      handleUpdateSettingsShowPasswords,
      onChange,
      showPasswords,
      isVariableUncovered,
    } = this.props;

    const { authentication } = request;

    if (authentication.type === AUTH_BASIC) {
      return (
        <BasicAuth
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
          showPasswords={showPasswords}
          isVariableUncovered={isVariableUncovered}
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
          isVariableUncovered={isVariableUncovered}
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
          isVariableUncovered={isVariableUncovered}
        />
      );
    } else if (authentication.type === AUTH_OAUTH_1) {
      return (
        <OAuth1Auth
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          showPasswords={showPasswords}
          onChange={onChange}
          isVariableUncovered={isVariableUncovered}
        />
      );
    } else if (authentication.type === AUTH_DIGEST) {
      return (
        <DigestAuth
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
          showPasswords={showPasswords}
          isVariableUncovered={isVariableUncovered}
        />
      );
    } else if (authentication.type === AUTH_NTLM) {
      return (
        <NTLMAuth
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          onChange={onChange}
          showPasswords={showPasswords}
          isVariableUncovered={isVariableUncovered}
        />
      );
    } else if (authentication.type === AUTH_BEARER) {
      return (
        <BearerAuth
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
          isVariableUncovered={isVariableUncovered}
        />
      );
    } else if (authentication.type === AUTH_AWS_IAM) {
      return (
        <AWSAuth
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
          showPasswords={showPasswords}
          isVariableUncovered={isVariableUncovered}
        />
      );
    } else if (authentication.type === AUTH_NETRC) {
      return <NetrcAuth/>;
    } else if (authentication.type === AUTH_ASAP) {
      return (
        <AsapAuth
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={onChange}
          isVariableUncovered={isVariableUncovered}
        />
      );
    } else {
      return (
        <div className="vertically-center text-center">
          <p className="pad super-faint text-sm text-center">
            <i className="fa fa-unlock-alt" style={{ fontSize: '8rem', opacity: 0.3 }}/>
            <br/>
            <br/>
            Select an auth type from above
          </p>
        </div>
      );
    }
  }

  render() {
    return (
      <div className="tall">
        {this.renderEditor()}
      </div>
    );
  }
}

export default AuthWrapper;
