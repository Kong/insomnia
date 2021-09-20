import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import {
  AUTH_ASAP,
  AUTH_AWS_IAM,
  AUTH_BASIC,
  AUTH_BEARER,
  AUTH_DIGEST,
  AUTH_HAWK,
  AUTH_NETRC,
  AUTH_NTLM,
  AUTH_OAUTH_1,
  AUTH_OAUTH_2,
  AUTOBIND_CFG,
} from '../../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../../common/render';
import type { OAuth2Token } from '../../../../models/o-auth-2-token';
import type { Request, RequestAuthentication } from '../../../../models/request';
import type { Settings } from '../../../../models/settings';
import AsapAuth from './asap-auth';
import AWSAuth from './aws-auth';
import BasicAuth from './basic-auth';
import BearerAuth from './bearer-auth';
import DigestAuth from './digest-auth';
import HawkAuth from './hawk-auth';
import { NetrcAuth } from './netrc-auth';
import NTLMAuth from './ntlm-auth';
import OAuth1Auth from './o-auth-1-auth';
import OAuth2Auth from './o-auth-2-auth';

interface Props {
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  handleUpdateSettingsShowPasswords: (showPasswords: boolean) => Promise<Settings>;
  nunjucksPowerUserMode: boolean;
  onChange: (arg0: Request, arg1: RequestAuthentication) => Promise<Request>;
  request: Request;
  showPasswords: boolean;
  isVariableUncovered: boolean;
  oAuth2Token?: OAuth2Token | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class AuthWrapper extends PureComponent<Props> {
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
      return <NetrcAuth />;
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
            <i
              className="fa fa-unlock-alt"
              style={{
                fontSize: '8rem',
                opacity: 0.3,
              }}
            />
            <br />
            <br />
            Select an auth type from above
          </p>
        </div>
      );
    }
  }

  render() {
    return <div className="tall">{this.renderEditor()}</div>;
  }
}

export default AuthWrapper;
