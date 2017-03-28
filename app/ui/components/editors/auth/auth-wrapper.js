import React, {PropTypes, PureComponent} from 'react';
import {AUTH_BASIC, AUTH_DIGEST, AUTH_NTLM, AUTH_OAUTH_1, AUTH_OAUTH_2} from '../../../../common/constants';
import BasicAuth from './basic-auth';
import DigestAuth from './digest-auth';
import NTLMAuth from './ntlm-auth';
import OAuth2 from './o-auth-2';
import autobind from 'autobind-decorator';

@autobind
class AuthWrapper extends PureComponent {
  renderEditor () {
    const {
      oAuth2Token,
      request,
      handleRender,
      handleGetRenderContext,
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
          onChange={onChange}
          showPasswords={showPasswords}
        />
      );
    } else if (authentication.type === AUTH_OAUTH_2) {
      return (
        <OAuth2
          oAuth2Token={oAuth2Token}
          request={request}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          onChange={onChange}
          showPasswords={showPasswords}
        />
      );
    } else if (authentication.type === AUTH_OAUTH_1) {
      return (
        <div className="vertically-center text-center">
          <p className="pad super-faint text-sm text-center">
            <i className="fa fa-commenting" style={{fontSize: '8rem', opacity: 0.3}}/>
            <br/><br/>
            Don't worry, OAuth 1.0 is coming soon!
          </p>
        </div>
      );
    } else if (authentication.type === AUTH_DIGEST) {
      return (
        <DigestAuth
          authentication={authentication}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
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
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          onChange={onChange}
          showPasswords={showPasswords}
        />
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

AuthWrapper.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  handleUpdateSettingsShowPasswords: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,
  showPasswords: PropTypes.bool.isRequired,

  // Optional
  oAuth2Token: PropTypes.object
};

export default AuthWrapper;
