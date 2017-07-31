// @flow
import type {Request} from '../../../../models/request';
import type {OAuth2Token} from '../../../../models/o-auth-2-token';

import React from 'react';
import moment from 'moment';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import * as misc from '../../../../common/misc';
import {GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_CLIENT_CREDENTIALS, GRANT_TYPE_IMPLICIT, GRANT_TYPE_PASSWORD} from '../../../../network/o-auth-2/constants';
import authorizationUrls from '../../../../datasets/authorization-urls';
import accessTokenUrls from '../../../../datasets/access-token-urls';
import getAccessToken from '../../../../network/o-auth-2/get-token';
import * as models from '../../../../models';
import Link from '../../base/link';
import {trackEvent} from '../../../../analytics/index';
import HelpTooltip from '../../help-tooltip';

const getAuthorizationUrls = () => authorizationUrls;
const getAccessTokenUrls = () => accessTokenUrls;

@autobind
class OAuth2Auth extends React.PureComponent {
  props: {
    handleRender: Function,
    handleGetRenderContext: Function,
    handleUpdateSettingsShowPasswords: Function,
    onChange: Function,
    request: Request,
    showPasswords: boolean,

    // Optional
    oAuth2Token: OAuth2Token | null
  };

  state: {
    error: string,
    loading: boolean
  };

  _handleChangeProperty: Function;

  constructor (props: any) {
    super(props);

    this.state = {
      error: '',
      loading: false
    };

    this._handleChangeProperty = misc.debounce(this._handleChangeProperty, 500);
  }

  async _handleUpdateAccessToken (e: Event & {target: HTMLButtonElement}): Promise<void> {
    const {oAuth2Token} = this.props;
    const accessToken = e.target.value;

    if (oAuth2Token) {
      await models.oAuth2Token.update(oAuth2Token, {accessToken});
    } else {
      await models.oAuth2Token.create({accessToken, parentId: this.props.request._id});
    }
  }

  async _handleUpdateRefreshToken (e: Event & {target: HTMLButtonElement}): Promise<void> {
    const {oAuth2Token} = this.props;
    const refreshToken = e.target.value;

    if (oAuth2Token) {
      await models.oAuth2Token.update(oAuth2Token, {refreshToken});
    } else {
      await models.oAuth2Token.create({refreshToken, parentId: this.props.request._id});
    }
  }

  async _handleClearTokens (): Promise<void> {
    const oAuth2Token = await models.oAuth2Token.getByParentId(this.props.request._id);
    if (oAuth2Token) {
      await models.oAuth2Token.remove(oAuth2Token);
    }
  }

  async _handleRefreshToken (): Promise<void> {
    // First, clear the state and the current tokens
    this.setState({error: '', loading: true});

    const {request} = this.props;

    try {
      const authentication = await this.props.handleRender(request.authentication);
      await getAccessToken(request._id, authentication, true);
      this.setState({loading: false});
    } catch (err) {
      await this._handleClearTokens(); // Clear existing tokens if there's an error
      this.setState({error: err.message, loading: false});
    }
  }

  _handleChangeProperty (property: string, value: string | boolean): void {
    const {request} = this.props;
    const authentication = Object.assign({}, request.authentication, {[property]: value});
    this.props.onChange(authentication);
  }

  _handleChangeClientId (value: string): void {
    this._handleChangeProperty('clientId', value);
  }

  _handleChangeCredentialsInBody (e: Event & {target: HTMLButtonElement}): void {
    this._handleChangeProperty('credentialsInBody', e.target.value === 'true');
  }

  _handleChangeClientSecret (value: string): void {
    this._handleChangeProperty('clientSecret', value);
  }

  _handleChangeAuthorizationUrl (value: string): void {
    this._handleChangeProperty('authorizationUrl', value);
  }

  _handleChangeAccessTokenUrl (value: string): void {
    this._handleChangeProperty('accessTokenUrl', value);
  }

  _handleChangeRedirectUrl (value: string): void {
    this._handleChangeProperty('redirectUrl', value);
  }

  _handleChangeScope (value: string): void {
    this._handleChangeProperty('scope', value);
  }

  _handleChangeState (value: string): void {
    this._handleChangeProperty('state', value);
  }

  _handleChangeUsername (value: string): void {
    this._handleChangeProperty('username', value);
  }

  _handleChangePassword (value: string): void {
    this._handleChangeProperty('password', value);
  }

  _handleChangeGrantType (e: Event & {target: HTMLButtonElement}): void {
    trackEvent('OAuth 2', 'Change Grant Type', e.target.value);
    this._handleChangeProperty('grantType', e.target.value);
  }

  renderInputRow (
    label: string,
    property: string,
    onChange: Function,
    help: string | null = null,
    handleAutocomplete: Function | null = null
  ): React.Element<*> {
    const {handleRender, handleGetRenderContext, request} = this.props;
    const id = label.replace(/ /g, '-');
    const type = !this.props.showPasswords && property === 'password' ? 'password' : 'text';
    return (
      <tr key={id}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={id} className="label--small no-pad">
            {label}
            {help && <HelpTooltip>{help}</HelpTooltip>}
          </label>
        </td>
        <td className="wide">
          <div className="form-control form-control--underlined no-margin">
            <OneLineEditor
              id={id}
              type={type}
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

  renderSelectRow (
    label: string,
    property: string,
    options: Array<{name: string, value: string}>,
    onChange: Function,
    help: string | null = null
  ): React.Element<*> {
    const {request} = this.props;
    const id = label.replace(/ /g, '-');
    const value = request.authentication.hasOwnProperty(property)
      ? request.authentication[property]
      : options[0];

    return (
      <tr key={id}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={id} className="label--small no-pad">
            {label}
            {help && <HelpTooltip>{help}</HelpTooltip>}
          </label>
        </td>
        <td className="wide">
          <div className="form-control form-control--outlined no-margin">
            <select id={id} onChange={onChange} value={value}>
              {options.map(({name, value}) => (
                <option key={value} value={value}>{name}</option>
              ))}
            </select>
          </div>
        </td>
      </tr>
    );
  }

  renderGrantTypeFields (grantType: string): Array<React.Element<*>> {
    let fields = [];

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
      null,
      getAuthorizationUrls
    );

    const accessTokenUrl = this.renderInputRow(
      'Access Token URL',
      'accessTokenUrl',
      this._handleChangeAccessTokenUrl,
      null,
      getAccessTokenUrls
    );

    const redirectUri = this.renderInputRow(
      'Redirect URL',
      'redirectUrl',
      this._handleChangeRedirectUrl,
      'Insomnia will intercept this no matter what, so it can be whatever you want/need'
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
      [
        {name: 'As Basic Auth Header (default)', value: 'false'},
        {name: 'In Request Body', value: 'true'}
      ],
      this._handleChangeCredentialsInBody,
      'Whether or not to send credentials as Basic Auth, or as plain text in the request body',
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

  renderExpireAt (token: OAuth2Token | null): React.Element<*> | string | null {
    if (!token) {
      return null;
    }

    if (!token.expiresAt) {
      return '(never expires)';
    }

    const expiresAt = new Date(token.expiresAt);
    const str = moment(expiresAt).fromNow();
    return <span title={expiresAt.toString()}>(expires {str})</span>;
  }

  render () {
    const {request, oAuth2Token: tok} = this.props;
    const {loading, error} = this.state;

    const expireLabel = this.renderExpireAt(tok);

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
          {error && (
            <p className="notice warning margin-bottom">
              {error}
            </p>
          )}

          {/* Handle minor errors */}
          {(tok && tok.error) && (
            <div className="notice error margin-bottom">
              <h2 className="no-margin-top txt-lg force-wrap">
                {tok.error}
              </h2>
              <p>
                {tok.errorDescription || 'no description provided'}
                {tok.errorUri && (
                  <span>&nbsp;
                    <Link href={tok.errorUri} title={tok.errorUri}>
                      <i className="fa fa-question-circle"/>
                    </Link>
                  </span>
                )}
              </p>
            </div>
          )}
          <div className="form-control form-control--outlined">
            <label>
              <small>
                Refresh Token
              </small>
              <input value={(tok && tok.refreshToken) || ''}
                     placeholder="n/a"
                     onChange={this._handleUpdateRefreshToken}/>
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              <small>
                Access Token {tok ? <em>{expireLabel}</em> : null}
              </small>
              <input value={(tok && tok.accessToken) || ''}
                     placeholder="n/a"
                     onChange={this._handleUpdateAccessToken}/>
            </label>
          </div>
          <div className="pad-top text-right">
            {tok && (
              <button className="btn btn--clicky" onClick={this._handleClearTokens}>
                Clear Tokens
              </button>
            )}
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

export default OAuth2Auth;
