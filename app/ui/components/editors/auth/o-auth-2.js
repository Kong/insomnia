import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import * as misc from '../../../../common/misc';
import {GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_CLIENT_CREDENTIALS, GRANT_TYPE_PASSWORD, GRANT_TYPE_IMPLICIT} from '../../../../network/o-auth-2/constants';
import authorizationUrls from '../../../../datasets/authorization-urls';
import accessTokenUrls from '../../../../datasets/access-token-urls';
import getAccessToken from '../../../../network/o-auth-2/get-token';
import * as models from '../../../../models';
import Link from '../../base/link';
import {trackEvent} from '../../../../analytics/index';

const getAuthorizationUrls = () => authorizationUrls;
const getAccessTokenUrls = () => accessTokenUrls;

@autobind
class OAuth2 extends PureComponent {
  constructor (props) {
    super(props);

    this.state = {
      error: '',
      loading: false
    };

    this._handleChangeProperty = misc.debounce(this._handleChangeProperty, 500);
  }

  async _handleClearTokens () {
    const oAuth2Token = await models.oAuth2Token.getByParentId(this.props.request._id);
    if (oAuth2Token) {
      await models.oAuth2Token.remove(oAuth2Token);
    }
  }

  async _handleRefreshToken () {
    // First, clear the state and the current tokens
    this.setState({error: '', loading: true});

    const {request} = this.props;

    try {
      const authentication = await this.props.handleRender(request.authentication);
      const oAuth2Token = await getAccessToken(request._id, authentication, true);
      this.setState({token: oAuth2Token, loading: false});
    } catch (err) {
      await this._handleClearTokens(); // Clear existing tokens if there's an error
      this.setState({error: err.message, loading: false});
    }
  }

  _handleChangeProperty (property, value) {
    const {request} = this.props;
    const authentication = Object.assign({}, request.authentication, {[property]: value});
    this.props.onChange(authentication);
  }

  _handleChangeClientId (value) {
    this._handleChangeProperty('clientId', value);
  }

  _handleChangeCredentialsInBody (value) {
    this._handleChangeProperty('credentialsInBody', value);
  }

  _handleChangeClientSecret (value) {
    this._handleChangeProperty('clientSecret', value);
  }

  _handleChangeAuthorizationUrl (value) {
    this._handleChangeProperty('authorizationUrl', value);
  }

  _handleChangeAccessTokenUrl (value) {
    this._handleChangeProperty('accessTokenUrl', value);
  }

  _handleChangeRedirectUrl (value) {
    this._handleChangeProperty('redirectUrl', value);
  }

  _handleChangeScope (value) {
    this._handleChangeProperty('scope', value);
  }

  _handleChangeState (value) {
    this._handleChangeProperty('state', value);
  }

  _handleChangeUsername (value) {
    this._handleChangeProperty('username', value);
  }

  _handleChangePassword (value) {
    this._handleChangeProperty('password', value);
  }

  _handleChangeGrantType (e) {
    trackEvent('OAuth 2', 'Change Grant Type', e.target.value);
    this._handleChangeProperty('grantType', e.target.value);
  }

  renderInputRow (label, property, onChange, handleAutocomplete = null) {
    const {handleRender, handleGetRenderContext, request} = this.props;
    const id = label.replace(/ /g, '-');
    return (
      <tr key={id}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={id} className="label--small no-pad">{label}</label>
        </td>
        <td className="wide">
          <div className="form-control form-control--underlined no-margin">
            <OneLineEditor
              id={id}
              onChange={onChange}
              defaultValue={request.authentication[property] || ''}
              render={handleRender}
              getAutocompleteConstants={handleAutocomplete}
              getRenderContext={handleGetRenderContext}
            />
          </div>
        </td>
      </tr>
    );
  }

  renderSelectRow (label, property, options, onChange) {
    const {request} = this.props;
    const id = label.replace(/ /g, '-');
    return (
      <tr key={id}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={id} className="label--small no-pad">{label}</label>
        </td>
        <td className="wide">
          <div className="form-control form-control--outlined no-margin">
            <select id={id}
                    onChange={onChange}
                    value={request.authentication[property] || options[0].value}>
              {options.map(({name, value}) => (
                <option key={value} value={value}>{name}</option>
              ))}
            </select>
          </div>
        </td>
      </tr>
    );
  }

  renderGrantTypeFields (grantType) {
    let fields = null;

    const clientId = this.renderInputRow(
      'Client ID',
      'clientId',
      this._handleChangeClientId
    );

    const clientSecret = this.renderInputRow(
      'Client Secret',
      'clientSecret',
      this._handleChangeClientSecret
    );

    const authorizationUrl = this.renderInputRow(
      'Authorization URL',
      'authorizationUrl',
      this._handleChangeAuthorizationUrl,
      getAuthorizationUrls
    );

    const accessTokenUrl = this.renderInputRow(
      'Access Token URL',
      'accessTokenUrl',
      this._handleChangeAccessTokenUrl,
      getAccessTokenUrls
    );

    const redirectUri = this.renderInputRow(
      'Redirect URL',
      'redirectUrl',
      this._handleChangeRedirectUrl
    );

    const state = this.renderInputRow(
      'State',
      'state',
      this._handleChangeState
    );

    const scope = this.renderInputRow(
      'Scope',
      'scope',
      this._handleChangeScope
    );

    const username = this.renderInputRow(
      'Username',
      'username',
      this._handleChangeUsername
    );

    const password = this.renderInputRow(
      'Password',
      'password',
      this._handleChangePassword
    );

    const credentialsInBody = this.renderSelectRow(
      'Client Credentials',
      'credentialsInBody',
      [{
        name: 'As Basic Auth Header (default)',
        value: false
      }, {
        name: 'In Request Body',
        value: true
      }],
      this._handleChangeCredentialsInBody
    );

    if (grantType === GRANT_TYPE_AUTHORIZATION_CODE) {
      fields = [
        authorizationUrl,
        accessTokenUrl,
        clientId,
        clientSecret,
        credentialsInBody,
        redirectUri,
        scope,
        state
      ];
    } else if (grantType === GRANT_TYPE_CLIENT_CREDENTIALS) {
      fields = [
        accessTokenUrl,
        clientId,
        clientSecret,
        credentialsInBody,
        scope
      ];
    } else if (grantType === GRANT_TYPE_PASSWORD) {
      fields = [
        username,
        password,
        accessTokenUrl,
        clientId,
        clientSecret,
        credentialsInBody,
        scope
      ];
    } else if (grantType === GRANT_TYPE_IMPLICIT) {
      fields = [
        authorizationUrl,
        clientId,
        redirectUri,
        scope,
        state
      ];
    }

    return fields;
  }

  renderExpireAt (token) {
    if (!token) {
      return null;
    }

    if (!token.expireAt) {
      return <em>(never expires)</em>;
    }

    return <em>`(expires ${new Date(token.expireAt)})`</em>;
  }

  render () {
    const {request, oAuth2Token: tok} = this.props;
    const {loading, error} = this.state;
    return (
      <div className="pad">
        <table>
          <tbody>
          {this.renderSelectRow('Grant Type', 'grantType', [
            {name: 'Authorization Code', value: GRANT_TYPE_AUTHORIZATION_CODE},
            {name: 'Implicit', value: GRANT_TYPE_IMPLICIT},
            {name: 'Resource Owner Password Credentials', value: GRANT_TYPE_PASSWORD},
            {name: 'Client Credentials', value: GRANT_TYPE_CLIENT_CREDENTIALS}
          ], this._handleChangeGrantType)}
          {this.renderGrantTypeFields(request.authentication.grantType)}
          </tbody>
        </table>
        <div className="pad-top-sm">

          {/* Handle major errors */}
          {error ? (
            <p className="notice warning margin-bottom">
              {error}
            </p>
          ) : null}

          {/* Handle minor errors */}
          {tok && tok.error ? (
            <div className="notice error margin-bottom">
              <h2 className="no-margin-top txt-lg force-wrap">
                {tok.error}
              </h2>
              <p>
                {tok.errorDescription || 'no description provided'}
                {tok.errorUri ? (
                  <span>&nbsp;
                    <Link href={tok.errorUri} title={tok.errorUri}>
                      <i className="fa fa-question-circle"/>
                    </Link>
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
          <div>
            <label className="label--small">
              Refresh Token
              {' '}
              <span>{(tok && tok.refreshToken) ? this.renderExpireAt(tok) : null}</span>
            </label>
            <code className="block selectable">
              {(tok && tok.refreshToken) || <span className="faded">n/a</span>}
            </code>
          </div>
          <div className="pad-top-sm">
            <label className="label--small">
              Access Token
              {' '}
              <span>{(tok && !tok.refreshToken) ? this.renderExpireAt(tok) : null}</span>
            </label>
            <code className="block selectable">
              {(tok && tok.accessToken) || <span className="faded">n/a</span>}
            </code>
          </div>
          <div className="pad-top text-right">
            {tok ? (
              <button className="btn btn--clicky" onClick={this._handleClearTokens}>
                Clear Tokens
              </button>
            ) : null}
            &nbsp;&nbsp;
            <button className="btn btn--clicky"
                    onClick={this._handleRefreshToken}
                    disabled={loading}>
              {loading
                ? (tok ? 'Refreshing...' : 'Fetching...')
                : (tok ? 'Refresh Token' : 'Fetch Tokens')
              }
            </button>
          </div>
        </div>
      </div>
    );
  }
}

OAuth2.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  handleUpdateSettingsShowPasswords: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,
  showPasswords: PropTypes.bool.isRequired,

  // Optional
  oAuth2Token: PropTypes.object
};

export default OAuth2;
