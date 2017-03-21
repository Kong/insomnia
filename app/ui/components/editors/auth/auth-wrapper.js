import React, {PropTypes, PureComponent} from 'react';
import {AUTH_BASIC, AUTH_NONE, AUTH_OAUTH_2} from '../../../../common/constants';
import AlertModal from '../../modals/alert-modal';
import BasicAuth from './basic-auth';
import OAuth2 from './o-auth-2';
import autobind from 'autobind-decorator';
import {showModal} from '../../modals/index';

@autobind
class AuthWrapper extends PureComponent {
  async _handleTypeChange (e) {
    const newAuthentication = {type: e.target.value};

    try {
      await showModal(AlertModal, {
        title: 'Switch Authentication Mode',
        message: 'Your current authentication settings will be lost. Are you sure you want to switch?',
        addCancel: true
      });
    } catch (err) {
      // Cancelled
      return;
    }

    this.props.onChange(newAuthentication);
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
          <label className="label--small" htmlFor="auth-type">Authentication Type</label>
          <select id="auth-type"
                  value={authentication.type || AUTH_NONE}
                  onChange={this._handleTypeChange}>
            <option value={AUTH_NONE}>None</option>
            <option value={AUTH_BASIC}>Basic Auth</option>
            {/* <option value={AUTH_DIGEST}>Digest</option> */}
            {/* <option value={AUTH_OAUTH_1}>OAuth 1</option> */}
            <option value={AUTH_OAUTH_2}>OAuth 2</option>
          </select>
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
