import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import * as misc from '../../../../common/misc';
import {GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_CLIENT_CREDENTIALS, GRANT_TYPE_PASSWORD, GRANT_TYPE_IMPLICIT} from '../../../../network/o-auth-2/constants';
import authorizationUrls from '../../../../datasets/authorization-urls';
import accessTokenUrls from '../../../../datasets/access-token-urls';
import getAccessToken from '../../../../network/o-auth-2/get-token';
import * as models from '../../../../models';

const getAuthorizationUrls = () => authorizationUrls;
const getAccessTokenUrls = () => accessTokenUrls;

@autobind
class OAuth2 extends PureComponent {
  constructor (props) {
    super(props);

    this.state = {
      token: null
    };

    this._mounted = false;
    this._handleChangeProperty = misc.debounce(this._handleChangeProperty, 500);
  }

  async _handleRefreshToken () {
    const {request} = this.props;
    const authentication = await this.props.handleRender(request.authentication);
    const oAuth2Token = await getAccessToken(request._id, authentication, true);

    this.setState({token: oAuth2Token});
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
    this._handleChangeProperty('grantType', e.target.value);
  }

  async _loadToken () {
    if (this.props.request) {
      const token = await models.oAuth2Token.getByParentId(this.props.request._id);
      if (token && this._mounted) {
        this.setState({token});
      }
    }
  }

  componentDidUpdate () {
    this._loadToken();
  }

  componentDidMount () {
    this._loadToken();
    this._mounted = true;
  }

  componentWillUnmount () {
    this._mounted = false;
  }

  renderInputRow (label, property, onChange, handleAutocomplete = null) {
    const {handleRender, handleGetRenderContext, request} = this.props;
    const id = label.replace(/ /g, '-');
    return (
      <tr className="height-md" key={id}>
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
      <tr className="height-md" key={id}>
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

  render () {
    const {request} = this.props;
    const {token} = this.state;
    return (
      <div className="pad-top-sm">
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
        {token ? (
          <div className="pad-top">
            <label className="label--small">Refresh Token</label>
            <code className="block selectable">
              {token.refreshToken || <span>&nbsp;</span>}
            </code>
            <br/>
            <label className="label--small">Access Token</label>
            <code className="block selectable">
              {token.accessToken || <span>&nbsp;</span>}
            </code>
            <div className="pad-top">
              <button className="btn btn--clicky pull-right"
                      onClick={this._handleRefreshToken}>
                Refresh Token
              </button>
            </div>
          </div>
        ) : null}
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
  showPasswords: PropTypes.bool.isRequired
};

export default OAuth2;
