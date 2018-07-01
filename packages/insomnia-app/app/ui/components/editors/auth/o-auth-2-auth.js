// @flow
import type { Request } from '../../../../models/request';
import type { OAuth2Token } from '../../../../models/o-auth-2-token';

import * as React from 'react';
import classnames from 'classnames';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import {
  GRANT_TYPE_AUTHORIZATION_CODE,
  GRANT_TYPE_CLIENT_CREDENTIALS,
  GRANT_TYPE_IMPLICIT,
  GRANT_TYPE_PASSWORD,
  RESPONSE_TYPE_ID_TOKEN,
  RESPONSE_TYPE_ID_TOKEN_TOKEN,
  RESPONSE_TYPE_TOKEN
} from '../../../../network/o-auth-2/constants';
import authorizationUrls from '../../../../datasets/authorization-urls';
import accessTokenUrls from '../../../../datasets/access-token-urls';
import getAccessToken from '../../../../network/o-auth-2/get-token';
import * as models from '../../../../models';
import Link from '../../base/link';
import HelpTooltip from '../../help-tooltip';
import PromptButton from '../../base/prompt-button';
import TimeFromNow from '../../time-from-now';
import Button from '../../base/button';
import { showModal } from '../../modals';
import ResponseDebugModal from '../../modals/response-debug-modal';

type Props = {
  handleRender: Function,
  handleGetRenderContext: Function,
  handleUpdateSettingsShowPasswords: Function,
  nunjucksPowerUserMode: boolean,
  onChange: Function,
  request: Request,
  showPasswords: boolean,

  // Optional
  oAuth2Token: OAuth2Token | null
};

type State = {
  error: string,
  loading: boolean,
  showAdvanced: boolean
};

const getAuthorizationUrls = () => authorizationUrls;
const getAccessTokenUrls = () => accessTokenUrls;

let showAdvanced = false;

@autobind
class OAuth2Auth extends React.PureComponent<Props, State> {
  _handleChangeProperty: Function;

  constructor(props: any) {
    super(props);

    this.state = {
      error: '',
      loading: false,
      showAdvanced: showAdvanced // Remember from last time
    };
  }

  _handleToggleAdvanced(): void {
    // Remember this for the entirety of the session
    showAdvanced = !this.state.showAdvanced;
    this.setState({ showAdvanced });
  }

  async _handleUpdateAccessToken(
    e: SyntheticEvent<HTMLInputElement>
  ): Promise<void> {
    const { oAuth2Token } = this.props;
    const accessToken = e.currentTarget.value;

    if (oAuth2Token) {
      await models.oAuth2Token.update(oAuth2Token, { accessToken });
    } else {
      await models.oAuth2Token.create({
        accessToken,
        parentId: this.props.request._id
      });
    }
  }

  async _handleUpdateRefreshToken(
    e: SyntheticEvent<HTMLInputElement>
  ): Promise<void> {
    const { oAuth2Token } = this.props;
    const refreshToken = e.currentTarget.value;

    if (oAuth2Token) {
      await models.oAuth2Token.update(oAuth2Token, { refreshToken });
    } else {
      await models.oAuth2Token.create({
        refreshToken,
        parentId: this.props.request._id
      });
    }
  }

  async _handleClearTokens(): Promise<void> {
    const oAuth2Token = await models.oAuth2Token.getByParentId(
      this.props.request._id
    );
    if (oAuth2Token) {
      await models.oAuth2Token.remove(oAuth2Token);
    }
  }

  _handleDebugResponseClick(responseId: string) {
    const { oAuth2Token } = this.props;

    if (!oAuth2Token || !oAuth2Token.xResponseId) {
      return;
    }

    showModal(ResponseDebugModal, { responseId: oAuth2Token.xResponseId });
  }

  async _handleRefreshToken(): Promise<void> {
    // First, clear the state and the current tokens
    this.setState({ error: '', loading: true });

    const { request } = this.props;

    try {
      const authentication = await this.props.handleRender(
        request.authentication
      );
      await getAccessToken(request._id, authentication, true);
      this.setState({ loading: false });
    } catch (err) {
      await this._handleClearTokens(); // Clear existing tokens if there's an error
      this.setState({ error: err.message, loading: false });
    }
  }

  _handleChangeProperty(property: string, value: string | boolean): void {
    const { request } = this.props;
    const authentication = Object.assign({}, request.authentication, {
      [property]: value
    });
    this.props.onChange(authentication);
  }

  _handlerChangeResponseType(e: SyntheticEvent<HTMLInputElement>): void {
    this._handleChangeProperty('responseType', e.currentTarget.value);
  }

  _handleChangeClientId(value: string): void {
    this._handleChangeProperty('clientId', value);
  }

  _handleChangeCredentialsInBody(e: SyntheticEvent<HTMLInputElement>): void {
    this._handleChangeProperty(
      'credentialsInBody',
      e.currentTarget.value === 'true'
    );
  }

  _handleChangeEnabled(value: boolean): void {
    this._handleChangeProperty('disabled', value);
  }

  _handleChangeClientSecret(value: string): void {
    this._handleChangeProperty('clientSecret', value);
  }

  _handleChangeAuthorizationUrl(value: string): void {
    this._handleChangeProperty('authorizationUrl', value);
  }

  _handleChangeAccessTokenUrl(value: string): void {
    this._handleChangeProperty('accessTokenUrl', value);
  }

  _handleChangeRedirectUrl(value: string): void {
    this._handleChangeProperty('redirectUrl', value);
  }

  _handleChangeScope(value: string): void {
    this._handleChangeProperty('scope', value);
  }

  _handleChangeState(value: string): void {
    this._handleChangeProperty('state', value);
  }

  _handleChangeUsername(value: string): void {
    this._handleChangeProperty('username', value);
  }

  _handleChangePassword(value: string): void {
    this._handleChangeProperty('password', value);
  }

  _handleChangeTokenPrefix(value: string): void {
    this._handleChangeProperty('tokenPrefix', value);
  }

  _handleChangeAudience(value: string): void {
    this._handleChangeProperty('audience', value);
  }

  _handleChangeGrantType(e: SyntheticEvent<HTMLInputElement>): void {
    this._handleChangeProperty('grantType', e.currentTarget.value);
  }

  renderEnabledRow(onChange: boolean => void): React.Element<*> {
    const { request } = this.props;
    const { authentication } = request;
    return (
      <tr key="enabled">
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor="enabled" className="label--small no-pad">
            Enabled
          </label>
        </td>
        <td className="wide">
          <div className="form-control form-control--underlined no-margin">
            <Button
              className="btn btn--super-duper-compact"
              id="enabled"
              onClick={onChange}
              value={!authentication.disabled}
              title={authentication.disabled ? 'Enable item' : 'Disable item'}>
              {authentication.disabled ? (
                <i className="fa fa-square-o" />
              ) : (
                <i className="fa fa-check-square-o" />
              )}
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  renderInputRow(
    label: string,
    property: string,
    onChange: Function,
    help: string | null = null,
    handleAutocomplete: Function | null = null
  ): React.Element<*> {
    const {
      handleRender,
      handleGetRenderContext,
      request,
      nunjucksPowerUserMode
    } = this.props;
    const { authentication } = request;
    const id = label.replace(/ /g, '-');
    const type =
      !this.props.showPasswords && property === 'password'
        ? 'password'
        : 'text';
    return (
      <tr key={id}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={id} className="label--small no-pad">
            {label}
            {help && <HelpTooltip>{help}</HelpTooltip>}
          </label>
        </td>
        <td className="wide">
          <div
            className={classnames(
              'form-control form-control--underlined no-margin',
              {
                'form-control--inactive': authentication.disabled
              }
            )}>
            <OneLineEditor
              id={id}
              type={type}
              onChange={onChange}
              defaultValue={request.authentication[property] || ''}
              render={handleRender}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              getAutocompleteConstants={handleAutocomplete}
              getRenderContext={handleGetRenderContext}
            />
          </div>
        </td>
      </tr>
    );
  }

  renderSelectRow(
    label: string,
    property: string,
    options: Array<{ name: string, value: string }>,
    onChange: Function,
    help: string | null = null
  ): React.Element<*> {
    const { request } = this.props;
    const { authentication } = request;
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
          <div
            className={classnames(
              'form-control form-control--outlined no-margin',
              {
                'form-control--inactive': authentication.disabled
              }
            )}>
            <select id={id} onChange={onChange} value={value}>
              {options.map(({ name, value }) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </td>
      </tr>
    );
  }

  renderGrantTypeFields(
    grantType: string
  ): { basic: Array<React.Element<*>>, advanced: Array<React.Element<*>> } {
    let basicFields = [];
    let advancedFields = [];

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
      'This can be whatever you want or need it to be. Insomnia will automatically ' +
        'detect a redirect in the client browser window and extract the code from the ' +
        'redirected URL'
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

    const tokenPrefix = this.renderInputRow(
      'Header Prefix',
      'tokenPrefix',
      this._handleChangeTokenPrefix,
      'Change Authorization header prefix from Bearer to something else'
    );

    const responseType = this.renderSelectRow(
      'Response Type',
      'responseType',
      [
        { name: 'Access Token', value: RESPONSE_TYPE_TOKEN },
        { name: 'ID Token', value: RESPONSE_TYPE_ID_TOKEN },
        { name: 'ID and Access Token', value: RESPONSE_TYPE_ID_TOKEN_TOKEN }
      ],
      this._handlerChangeResponseType,
      'Indicates the type of credentials returned in the response'
    );

    const audience = this.renderInputRow(
      'Audience',
      'audience',
      this._handleChangeAudience,
      'Indicate what resource server to access'
    );

    const credentialsInBody = this.renderSelectRow(
      'Credentials',
      'credentialsInBody',
      [
        { name: 'As Basic Auth Header (default)', value: 'false' },
        { name: 'In Request Body', value: 'true' }
      ],
      this._handleChangeCredentialsInBody,
      'Whether or not to send credentials as Basic Auth, or as plain text in the request body'
    );

    const enabled = this.renderEnabledRow(this._handleChangeEnabled);

    if (grantType === GRANT_TYPE_AUTHORIZATION_CODE) {
      basicFields = [
        authorizationUrl,
        accessTokenUrl,
        clientId,
        clientSecret,
        redirectUri,
        enabled
      ];

      advancedFields = [scope, state, credentialsInBody, tokenPrefix];
    } else if (grantType === GRANT_TYPE_CLIENT_CREDENTIALS) {
      basicFields = [accessTokenUrl, clientId, clientSecret, enabled];

      advancedFields = [scope, credentialsInBody, tokenPrefix, audience];
    } else if (grantType === GRANT_TYPE_PASSWORD) {
      basicFields = [
        username,
        password,
        accessTokenUrl,
        clientId,
        clientSecret,
        enabled
      ];

      advancedFields = [scope, credentialsInBody, tokenPrefix];
    } else if (grantType === GRANT_TYPE_IMPLICIT) {
      basicFields = [authorizationUrl, clientId, redirectUri, enabled];

      advancedFields = [responseType, scope, state, tokenPrefix, audience];
    }

    return { basic: basicFields, advanced: advancedFields };
  }

  static renderExpireAt(
    token: OAuth2Token | null
  ): React.Element<*> | string | null {
    if (!token || !token.accessToken) {
      return null;
    }

    if (!token.expiresAt) {
      return '(never expires)';
    }

    return (
      <span>
        &#x28;expires <TimeFromNow timestamp={token.expiresAt} />&#x29;
      </span>
    );
  }

  renderError() {
    const { oAuth2Token } = this.props;

    const debugButton =
      oAuth2Token && oAuth2Token.xResponseId ? (
        <button
          onClick={this._handleDebugResponseClick}
          className="icon icon--success space-left"
          title="View response timeline">
          <i className="fa fa-bug" />
        </button>
      ) : null;

    const errorUriButton =
      oAuth2Token && oAuth2Token.errorUri ? (
        <Link
          href={oAuth2Token.errorUri}
          title={oAuth2Token.errorUri}
          className="space-left icon">
          <i className="fa fa-question-circle" />
        </Link>
      ) : null;

    const error = oAuth2Token ? oAuth2Token.error || oAuth2Token.xError : null;

    if (oAuth2Token && error) {
      const { errorDescription } = oAuth2Token;
      return (
        <div className="notice error margin-bottom">
          <h2 className="no-margin-top txt-lg force-wrap">{error}</h2>
          <p>
            {errorDescription || 'no description provided'}
            {errorUriButton}
            {debugButton}
          </p>
        </div>
      );
    }
  }

  render() {
    const { request, oAuth2Token: tok } = this.props;
    const { loading, error, showAdvanced } = this.state;

    const expireLabel = OAuth2Auth.renderExpireAt(tok);
    const fields = this.renderGrantTypeFields(request.authentication.grantType);

    return (
      <div className="pad">
        <table>
          <tbody>
            {this.renderSelectRow(
              'Grant Type',
              'grantType',
              [
                {
                  name: 'Authorization Code',
                  value: GRANT_TYPE_AUTHORIZATION_CODE
                },
                { name: 'Implicit', value: GRANT_TYPE_IMPLICIT },
                {
                  name: 'Resource Owner Password Credentials',
                  value: GRANT_TYPE_PASSWORD
                },
                {
                  name: 'Client Credentials',
                  value: GRANT_TYPE_CLIENT_CREDENTIALS
                }
              ],
              this._handleChangeGrantType
            )}
            {fields.basic}
            <tr>
              <td className="pad-top">
                <button onClick={this._handleToggleAdvanced} className="faint">
                  <i
                    style={{ minWidth: '0.8rem' }}
                    className={classnames(
                      'fa fa--skinny',
                      `fa-caret-${showAdvanced ? 'down' : 'right'}`
                    )}
                  />
                  Advanced Options
                </button>
              </td>
            </tr>
            {showAdvanced && fields.advanced}
          </tbody>
        </table>
        <div className="notice subtle margin-top text-left">
          {error && (
            <p className="selectable notice warning margin-bottom">{error}</p>
          )}
          {this.renderError()}
          <div className="form-control form-control--outlined">
            <label>
              <small>Refresh Token</small>
              <input
                value={(tok && tok.refreshToken) || ''}
                placeholder="n/a"
                onChange={this._handleUpdateRefreshToken}
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              <small>Access Token {tok ? <em>{expireLabel}</em> : null}</small>
              <input
                value={(tok && tok.accessToken) || ''}
                placeholder="n/a"
                onChange={this._handleUpdateAccessToken}
              />
            </label>
          </div>
          <div className="pad-top text-right">
            {tok ? (
              <PromptButton
                className="btn btn--clicky"
                onClick={this._handleClearTokens}>
                Clear
              </PromptButton>
            ) : null}
            &nbsp;&nbsp;
            <button
              className="btn btn--clicky"
              onClick={this._handleRefreshToken}
              disabled={loading}>
              {loading
                ? tok
                  ? 'Refreshing...'
                  : 'Fetching...'
                : tok
                  ? 'Refresh Token'
                  : 'Fetch Tokens'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default OAuth2Auth;
