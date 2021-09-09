import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { convertEpochToMilliseconds } from '../../../../common/misc';
import { HandleGetRenderContext, HandleRender } from '../../../../common/render';
import accessTokenUrls from '../../../../datasets/access-token-urls';
import authorizationUrls from '../../../../datasets/authorization-urls';
import * as models from '../../../../models';
import type { OAuth2Token } from '../../../../models/o-auth-2-token';
import type { Request, RequestAuthentication } from '../../../../models/request';
import type { Settings } from '../../../../models/settings';
import {
  GRANT_TYPE_AUTHORIZATION_CODE,
  GRANT_TYPE_CLIENT_CREDENTIALS,
  GRANT_TYPE_IMPLICIT,
  GRANT_TYPE_PASSWORD,
  PKCE_CHALLENGE_PLAIN,
  PKCE_CHALLENGE_S256,
  RESPONSE_TYPE_ID_TOKEN,
  RESPONSE_TYPE_ID_TOKEN_TOKEN,
  RESPONSE_TYPE_TOKEN,
} from '../../../../network/o-auth-2/constants';
import getAccessToken from '../../../../network/o-auth-2/get-token';
import { initNewOAuthSession } from '../../../../network/o-auth-2/misc';
import Button from '../../base/button';
import Link from '../../base/link';
import PromptButton from '../../base/prompt-button';
import OneLineEditor from '../../codemirror/one-line-editor';
import HelpTooltip from '../../help-tooltip';
import { showModal } from '../../modals';
import ResponseDebugModal from '../../modals/response-debug-modal';
import TimeFromNow from '../../time-from-now';

interface Props {
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  handleUpdateSettingsShowPasswords: (arg0: boolean) => Promise<Settings>;
  nunjucksPowerUserMode: boolean;
  onChange: (arg0: Request, arg1: RequestAuthentication) => Promise<Request>;
  request: Request;
  showPasswords: boolean;
  isVariableUncovered: boolean;
  oAuth2Token?: OAuth2Token | null;
}

interface State {
  error: string;
  loading: boolean;
  showAdvanced: boolean;
}

const getAuthorizationUrls = () => authorizationUrls;

const getAccessTokenUrls = () => accessTokenUrls;

let showAdvanced = false;

@autoBindMethodsForReact(AUTOBIND_CFG)
class OAuth2Auth extends PureComponent<Props, State> {
  state: State = {
    error: '',
    loading: false,
    showAdvanced, // Remember from last time
  };

  _handleToggleAdvanced() {
    // Remember this for the entirety of the session
    showAdvanced = !this.state.showAdvanced;
    this.setState({
      showAdvanced,
    });
  }

  async _handleUpdateAccessToken(e: React.SyntheticEvent<HTMLInputElement>) {
    const { oAuth2Token } = this.props;
    const accessToken = e.currentTarget.value;

    if (oAuth2Token) {
      await models.oAuth2Token.update(oAuth2Token, {
        accessToken,
      });
    } else {
      await models.oAuth2Token.create({
        accessToken,
        parentId: this.props.request._id,
      });
    }
  }

  async _handleUpdateIdentityToken(e: React.SyntheticEvent<HTMLInputElement>) {
    const { oAuth2Token } = this.props;
    const identityToken = e.currentTarget.value;

    if (oAuth2Token) {
      await models.oAuth2Token.update(oAuth2Token, {
        identityToken,
      });
    } else {
      await models.oAuth2Token.create({
        identityToken,
        parentId: this.props.request._id,
      });
    }
  }

  async _handleUpdateRefreshToken(e: React.SyntheticEvent<HTMLInputElement>) {
    const { oAuth2Token } = this.props;
    const refreshToken = e.currentTarget.value;

    if (oAuth2Token) {
      await models.oAuth2Token.update(oAuth2Token, {
        refreshToken,
      });
    } else {
      await models.oAuth2Token.create({
        refreshToken,
        parentId: this.props.request._id,
      });
    }
  }

  async _handleClearTokens() {
    const oAuth2Token = await models.oAuth2Token.getByParentId(this.props.request._id);

    if (oAuth2Token) {
      await models.oAuth2Token.remove(oAuth2Token);
    }
  }

  _handleDebugResponseClick() {
    const { oAuth2Token } = this.props;

    if (!oAuth2Token || !oAuth2Token.xResponseId) {
      return;
    }

    showModal(ResponseDebugModal, {
      responseId: oAuth2Token.xResponseId,
    });
  }

  async _handleRefreshToken() {
    // First, clear the state and the current tokens
    this.setState({
      error: '',
      loading: true,
    });
    const { request } = this.props;

    try {
      const authentication = await this.props.handleRender(request.authentication);
      await getAccessToken(request._id, authentication, true);
      this.setState({
        loading: false,
      });
    } catch (err) {
      await this._handleClearTokens(); // Clear existing tokens if there's an error

      this.setState({
        error: err.message,
        loading: false,
      });
    }
  }

  _handleChangeProperty(property: string, value: string | boolean) {
    const { onChange, request } = this.props;
    const authentication = Object.assign({}, request.authentication, {
      [property]: value,
    });
    onChange(request, authentication);
  }

  _handlerChangeResponseType(e: React.SyntheticEvent<HTMLInputElement>) {
    this._handleChangeProperty('responseType', e.currentTarget.value);
  }

  _handleChangeClientId(value: string) {
    this._handleChangeProperty('clientId', value);
  }

  _handleChangeCredentialsInBody(e: React.SyntheticEvent<HTMLInputElement>) {
    this._handleChangeProperty('credentialsInBody', e.currentTarget.value === 'true');
  }

  _handleChangeEnabled(value: boolean) {
    this._handleChangeProperty('disabled', value);
  }

  _handleChangeClientSecret(value: string) {
    this._handleChangeProperty('clientSecret', value);
  }

  _handleChangePkce(value: boolean) {
    this._handleChangeProperty('usePkce', value);
  }

  _handleChangePkceMethod(e: React.SyntheticEvent<HTMLInputElement>) {
    this._handleChangeProperty('pkceMethod', e.currentTarget.value);
  }

  _handleChangeAuthorizationUrl(value: string) {
    this._handleChangeProperty('authorizationUrl', value);
  }

  _handleChangeAccessTokenUrl(value: string) {
    this._handleChangeProperty('accessTokenUrl', value);
  }

  _handleChangeRedirectUrl(value: string) {
    this._handleChangeProperty('redirectUrl', value);
  }

  _handleChangeScope(value: string) {
    this._handleChangeProperty('scope', value);
  }

  _handleChangeState(value: string) {
    this._handleChangeProperty('state', value);
  }

  _handleChangeUsername(value: string) {
    this._handleChangeProperty('username', value);
  }

  _handleChangePassword(value: string) {
    this._handleChangeProperty('password', value);
  }

  _handleChangeTokenPrefix(value: string) {
    this._handleChangeProperty('tokenPrefix', value);
  }

  _handleChangeAudience(value: string) {
    this._handleChangeProperty('audience', value);
  }

  _handleChangeResource(value: string) {
    this._handleChangeProperty('resource', value);
  }

  _handleChangeOrigin(value: string) {
    this._handleChangeProperty('origin', value);
  }

  _handleChangeGrantType(e: React.SyntheticEvent<HTMLInputElement>) {
    this._handleChangeProperty('grantType', e.currentTarget.value);
  }

  renderEnabledRow(onChange: (arg0: boolean) => void) {
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
              title={authentication.disabled ? 'Enable item' : 'Disable item'}
            >
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

  renderUsePkceRow(onChange: (arg0: boolean) => void) {
    const { request } = this.props;
    const { authentication } = request;
    return (
      <tr key="use-pkce">
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor="use-pkce" className="label--small no-pad">
            Use PKCE
          </label>
        </td>
        <td className="wide">
          <div
            className={classnames('form-control form-control--underlined no-margin', {
              'form-control--inactive': authentication.disabled,
            })}
          >
            <Button
              className="btn btn--super-duper-compact"
              id="use-pkce"
              onClick={onChange}
              value={!authentication.usePkce}
              title={authentication.usePkce ? 'Disable PKCE' : 'Enable PKCE'}
            >
              {authentication.usePkce ? (
                <i className="fa fa-check-square-o" />
              ) : (
                <i className="fa fa-square-o" />
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
    onChange: (...args: any[]) => any,
    help: string | null = null,
    handleAutocomplete?: (...args: any[]) => any,
  ) {
    const {
      handleRender,
      handleGetRenderContext,
      request,
      nunjucksPowerUserMode,
      isVariableUncovered,
    } = this.props;
    const { authentication } = request;
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
          <div
            className={classnames('form-control form-control--underlined no-margin', {
              'form-control--inactive': authentication.disabled,
            })}
          >
            <OneLineEditor
              id={id}
              type={type}
              onChange={onChange}
              defaultValue={request.authentication[property] || ''}
              render={handleRender}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              getAutocompleteConstants={handleAutocomplete}
              getRenderContext={handleGetRenderContext}
              isVariableUncovered={isVariableUncovered}
            />
          </div>
        </td>
      </tr>
    );
  }

  renderSelectRow(
    label: string,
    property: string,
    options: {
      name: string;
      value: string;
    }[],
    onChange: (...args: any[]) => any,
    help: string | null = null,
    disabled = false,
  ) {
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
            className={classnames('form-control form-control--outlined no-margin', {
              'form-control--inactive': authentication.disabled || disabled,
            })}
          >
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

  renderGrantTypeFields(grantType: string) {
    const { authentication } = this.props.request;

    let basicFields: JSX.Element[] = [];
    let advancedFields: JSX.Element[] = [];
    const clientId = this.renderInputRow('Client ID', 'clientId', this._handleChangeClientId);
    const clientSecret = this.renderInputRow(
      'Client Secret',
      'clientSecret',
      this._handleChangeClientSecret,
    );
    const usePkce = this.renderUsePkceRow(this._handleChangePkce);
    const pkceMethod = this.renderSelectRow(
      'Code Challenge Method',
      'pkceMethod',
      [
        {
          name: 'SHA-256',
          value: PKCE_CHALLENGE_S256,
        },
        {
          name: 'Plain',
          value: PKCE_CHALLENGE_PLAIN,
        },
      ],
      this._handleChangePkceMethod,
      null,
      !Boolean(authentication.usePkce)
    );
    const authorizationUrl = this.renderInputRow(
      'Authorization URL',
      'authorizationUrl',
      this._handleChangeAuthorizationUrl,
      null,
      getAuthorizationUrls,
    );
    const accessTokenUrl = this.renderInputRow(
      'Access Token URL',
      'accessTokenUrl',
      this._handleChangeAccessTokenUrl,
      null,
      getAccessTokenUrls,
    );
    const redirectUri = this.renderInputRow(
      'Redirect URL',
      'redirectUrl',
      this._handleChangeRedirectUrl,
      'This can be whatever you want or need it to be. Insomnia will automatically ' +
        'detect a redirect in the client browser window and extract the code from the ' +
        'redirected URL',
    );
    const state = this.renderInputRow('State', 'state', this._handleChangeState);
    const scope = this.renderInputRow('Scope', 'scope', this._handleChangeScope);
    const username = this.renderInputRow('Username', 'username', this._handleChangeUsername);
    const password = this.renderInputRow('Password', 'password', this._handleChangePassword);
    const tokenPrefix = this.renderInputRow(
      'Header Prefix',
      'tokenPrefix',
      this._handleChangeTokenPrefix,
      'Change Authorization header prefix from "Bearer" to something else. Use "NO_PREFIX" to ' +
        'send raw token without prefix.',
    );
    const responseType = this.renderSelectRow(
      'Response Type',
      'responseType',
      [
        {
          name: 'Access Token',
          value: RESPONSE_TYPE_TOKEN,
        },
        {
          name: 'ID Token',
          value: RESPONSE_TYPE_ID_TOKEN,
        },
        {
          name: 'ID and Access Token',
          value: RESPONSE_TYPE_ID_TOKEN_TOKEN,
        },
      ],
      this._handlerChangeResponseType,
      'Indicates the type of credentials returned in the response',
    );
    const audience = this.renderInputRow(
      'Audience',
      'audience',
      this._handleChangeAudience,
      'Indicate what resource server to access',
    );
    const resource = this.renderInputRow(
      'Resource',
      'resource',
      this._handleChangeResource,
      'Indicate what resource to access',
    );
    const origin = this.renderInputRow(
      'Origin',
      'origin',
      this._handleChangeOrigin,
      'Specify Origin header when CORS is required for oauth endpoints',
    );
    const credentialsInBody = this.renderSelectRow(
      'Credentials',
      'credentialsInBody',
      [
        {
          name: 'As Basic Auth Header (default)',
          value: 'false',
        },
        {
          name: 'In Request Body',
          value: 'true',
        },
      ],
      this._handleChangeCredentialsInBody,
      'Whether or not to send credentials as Basic Auth, or as plain text in the request body',
    );
    const enabled = this.renderEnabledRow(this._handleChangeEnabled);

    if (grantType === GRANT_TYPE_AUTHORIZATION_CODE) {
      basicFields = [
        authorizationUrl,
        accessTokenUrl,
        clientId,
        clientSecret,
        usePkce,
        pkceMethod,
        redirectUri,
        enabled,
      ];

      advancedFields = [scope, state, credentialsInBody, tokenPrefix, audience, resource, origin];
    } else if (grantType === GRANT_TYPE_CLIENT_CREDENTIALS) {
      basicFields = [accessTokenUrl, clientId, clientSecret, enabled];
      advancedFields = [scope, credentialsInBody, tokenPrefix, audience, resource];
    } else if (grantType === GRANT_TYPE_PASSWORD) {
      basicFields = [username, password, accessTokenUrl, clientId, clientSecret, enabled];
      advancedFields = [scope, credentialsInBody, tokenPrefix, audience];
    } else if (grantType === GRANT_TYPE_IMPLICIT) {
      basicFields = [authorizationUrl, clientId, redirectUri, enabled];
      advancedFields = [responseType, scope, state, tokenPrefix, audience];
    }

    return {
      basic: basicFields,
      advanced: advancedFields,
    };
  }

  static renderIdentityTokenExpiry(token?: OAuth2Token | null) {
    if (!token || !token.identityToken) {
      return null;
    }

    const base64Url = token.identityToken.split('.')[1];
    let decodedString = '';

    try {
      decodedString = window.atob(base64Url);
    } catch (error) {
      return null;
    }

    const { exp } = JSON.parse(decodedString);

    if (!exp) {
      return '(never expires)';
    }

    const convertedExp = convertEpochToMilliseconds(exp);
    return (
      <span>
        &#x28;expires <TimeFromNow timestamp={convertedExp} />
        &#x29;
      </span>
    );
  }

  static renderAccessTokenExpiry(token?: OAuth2Token | null) {
    if (!token || !token.accessToken) {
      return null;
    }

    if (!token.expiresAt) {
      return '(never expires)';
    }

    return (
      <span>
        &#x28;expires <TimeFromNow timestamp={token.expiresAt} />
        &#x29;
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
          title="View response timeline"
        >
          <i className="fa fa-bug" />
        </button>
      ) : null;
    const errorUriButton =
      oAuth2Token && oAuth2Token.errorUri ? (
        <Link href={oAuth2Token.errorUri} title={oAuth2Token.errorUri} className="space-left icon">
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
    return undefined;
  }

  render() {
    const { request, oAuth2Token: tok } = this.props;
    const { loading, error, showAdvanced } = this.state;
    const accessExpireLabel = OAuth2Auth.renderAccessTokenExpiry(tok);
    const identityExpireLabel = OAuth2Auth.renderIdentityTokenExpiry(tok);
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
                  value: GRANT_TYPE_AUTHORIZATION_CODE,
                },
                {
                  name: 'Implicit',
                  value: GRANT_TYPE_IMPLICIT,
                },
                {
                  name: 'Resource Owner Password Credentials',
                  value: GRANT_TYPE_PASSWORD,
                },
                {
                  name: 'Client Credentials',
                  value: GRANT_TYPE_CLIENT_CREDENTIALS,
                },
              ],
              this._handleChangeGrantType,
            )}
            {fields.basic}
            <tr>
              <td className="pad-top">
                <button onClick={this._handleToggleAdvanced} className="faint">
                  <i
                    style={{
                      minWidth: '0.8rem',
                    }}
                    className={classnames(
                      'fa fa--skinny',
                      `fa-caret-${showAdvanced ? 'down' : 'right'}`,
                    )}
                  />
                  Advanced Options
                </button>
              </td>
            </tr>
            {showAdvanced && fields.advanced}
          </tbody>
        </table>
        {showAdvanced ? (
          <div className="pad-top text-right">
            <button className="btn btn--clicky" onClick={initNewOAuthSession}>
              Clear OAuth 2 session
            </button>
          </div>
        ) : null}
        <div className="notice subtle margin-top text-left">
          {error && <p className="selectable notice warning margin-bottom">{error}</p>}
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
              <small>Identity Token {tok ? <em>{identityExpireLabel}</em> : null}</small>
              <input
                value={(tok && tok.identityToken) || ''}
                placeholder="n/a"
                onChange={this._handleUpdateIdentityToken}
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              <small>Access Token {tok ? <em>{accessExpireLabel}</em> : null}</small>
              <input
                value={(tok && tok.accessToken) || ''}
                placeholder="n/a"
                onChange={this._handleUpdateAccessToken}
              />
            </label>
          </div>
          <div className="pad-top text-right">
            {tok ? (
              <PromptButton className="btn btn--clicky" onClick={this._handleClearTokens}>
                Clear
              </PromptButton>
            ) : null}
            &nbsp;&nbsp;
            <button
              className="btn btn--clicky"
              onClick={this._handleRefreshToken}
              disabled={loading}
            >
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
