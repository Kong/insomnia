import React, {PropTypes, PureComponent} from 'react';
import {AUTH_BASIC, AUTH_NONE, AUTH_OAUTH_2} from '../../../../common/constants';
import BasicAuth from './basic-auth';
import OAuth2 from './o-auth-2';
import autobind from 'autobind-decorator';

@autobind
class AuthWrapper extends PureComponent {
  _handleTypeChange (e) {
    const authentication = Object.assign(
      {},
      this.props.authentication,
      {type: e.target.value}
    );

    this.props.onChange(authentication);
  }

  renderEditor () {
    const {
      authentication,
      handleRender,
      handleGetRenderContext,
      handleUpdateSettingsShowPasswords,
      onChange,
      showPasswords
    } = this.props;

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
          authentication={authentication}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          handleUpdateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
          onChange={onChange}
          showPasswords={showPasswords}
        />
      );
    } else {
      return null;
    }
  }

  render () {
    const {authentication} = this.props;
    return (
      <div className="pad">
        <div className="form-control form-control--outlined">
          <label>Authentication Type
            <select value={authentication.type || AUTH_NONE} onChange={this._handleTypeChange}>
              <option value={AUTH_NONE}>None</option>
              <option value={AUTH_BASIC}>Basic Auth</option>
              {/* <option value={AUTH_DIGEST}>Digest</option> */}
              {/* <option value={AUTH_OAUTH_1}>OAuth 1</option> */}
              <option value={AUTH_OAUTH_2}>OAuth 2</option>
            </select>
          </label>
        </div>
        {this.renderEditor()}
      </div>
    );
  }
}

AuthWrapper.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  handleUpdateSettingsShowPasswords: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  authentication: PropTypes.object.isRequired,
  showPasswords: PropTypes.bool.isRequired
};

export default AuthWrapper;
