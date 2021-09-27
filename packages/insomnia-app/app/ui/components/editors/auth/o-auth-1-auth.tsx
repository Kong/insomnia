import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../../common/render';
import type { Request, RequestAuthentication } from '../../../../models/request';
import {
  SIGNATURE_METHOD_HMAC_SHA1,
  SIGNATURE_METHOD_HMAC_SHA256,
  SIGNATURE_METHOD_PLAINTEXT,
  SIGNATURE_METHOD_RSA_SHA1,
} from '../../../../network/o-auth-1/constants';
import { Button } from '../../base/button';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { HelpTooltip } from '../../help-tooltip';
import { showModal } from '../../modals';
import { CodePromptModal } from '../../modals/code-prompt-modal';

const PRIVATE_KEY_PLACEHOLDER = `
-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA39k9udklHnmkU0GtTLpnYtKk1l5txYmUD/cGI0bFd3HHOOLG
mI0av55vMFEhxL7yrFrcL8pRKp0+pnOVStMDmbwsPE/pu9pf3uxD+m9/Flv89bUk
mml+R3E8PwAYzkX0cr4yQTPN9PSSqy+d2+KrZ9QZmpc3tqltTbMVV93cxKCxfBrf
jbiMIAVh7silDVY5+V46SJu8zY2kXOBBtlrE7/JoMiTURCkRjNIA8/sgSmRxBTdM
313lKJM7NgxaGnREbP75U7ErfBvReJsf5p6h5+XXFirG7F2ntcqjUoR3M+opngp0
CgffdGcsK7MmUUgAG7r05b0mljhI35t/0Y57MwIDAQABAoIBAQCH1rLohudJmROp
Gl/qAewfQiiZlfATQavCDGuDGL1YAIme8a8GgApNYf2jWnidhiqJgRHBRor+yzFr
cJV+wRTs/Szp6LXAgMmTkKMJ+9XXErUIUgwbl27Y3Rv/9ox1p5VRg+A=
-----END RSA PRIVATE KEY-----
`.trim();

interface Props {
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  nunjucksPowerUserMode: boolean;
  showPasswords: boolean;
  isVariableUncovered: boolean;
  onChange: (arg0: Request, arg1: RequestAuthentication) => Promise<Request>;
  request: Request;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class OAuth1Auth extends PureComponent<Props> {
  _handleEditPrivateKey() {
    const { handleRender, handleGetRenderContext, request } = this.props;
    const { privateKey } = request.authentication;
    showModal(CodePromptModal, {
      submitName: 'Done',
      title: 'Edit Private Key',
      defaultValue: privateKey,
      onChange: this._handleChangePrivateKey,
      enableRender: handleRender || handleGetRenderContext,
      placeholder: PRIVATE_KEY_PLACEHOLDER,
      mode: 'text/plain',
      hideMode: true,
    });
  }

  _handleChangeProperty(property: string, value: string | boolean) {
    const { request } = this.props;
    const authentication = Object.assign({}, request.authentication, {
      [property]: value,
    });
    this.props.onChange(request, authentication);
  }

  _handleChangeConsumerKey(value: string) {
    this._handleChangeProperty('consumerKey', value);
  }

  _handleChangeConsumerSecret(value: string) {
    this._handleChangeProperty('consumerSecret', value);
  }

  _handleChangeTokenKey(value: string) {
    this._handleChangeProperty('tokenKey', value);
  }

  _handleChangeTokenSecret(value: string) {
    this._handleChangeProperty('tokenSecret', value);
  }

  _handleChangeRealm(value: string) {
    this._handleChangeProperty('realm', value);
  }

  _handleChangeCallback(value: string) {
    this._handleChangeProperty('callback', value);
  }

  _handleChangeNonce(value: string) {
    this._handleChangeProperty('nonce', value);
  }

  _handleChangeVerifier(value: string) {
    this._handleChangeProperty('verifier', value);
  }

  _handleChangeTimestamp(value: string) {
    this._handleChangeProperty('timestamp', value);
  }

  _handleChangeSignatureMethod(e: React.SyntheticEvent<HTMLInputElement>) {
    this._handleChangeProperty('signatureMethod', e.currentTarget.value);
  }

  _handleChangePrivateKey(value: string) {
    this._handleChangeProperty('privateKey', value);
  }

  _handleChangeIncludeBodyHash(value: boolean) {
    this._handleChangeProperty('includeBodyHash', value);
  }

  _handleChangeVersion(value: string) {
    this._handleChangeProperty('version', value);
  }

  _handleChangeEnabled(value: boolean) {
    this._handleChangeProperty('disabled', value);
  }

  renderCheckbox(
    label: string,
    property: string,
    help: string,
    onChange: (arg0: boolean) => void,
  ) {
    const { request } = this.props;
    const { authentication } = request;
    return (
      <tr key={label}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={label} className="label--small no-pad">
            {label}
            {help && <HelpTooltip> {help}</HelpTooltip>}
          </label>
        </td>
        <td className="wide">
          <div className="form-control no-margin">
            <Button
              className="btn btn--super-duper-compact"
              id={label}
              onClick={onChange}
              value={!authentication[property]}
            >
              {authentication[property] ? (
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
          <div className="form-control no-margin">
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

  renderInputRow(
    label: string,
    property: string,
    onChange: (...args: any[]) => any,
    help: string | null = null,
    handleAutocomplete?: ((...args: any[]) => any)
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
              'form-control--inactive': authentication.disabled,
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

  renderPrivateKeyInput(label: string) {
    const id = label.replace(/ /g, '-');
    const { authentication } = this.props.request;
    return (
      <tr key={id}>
        <td className="pad-right pad-top-sm no-wrap valign-top">
          <label htmlFor={id} className="label--small no-pad">
            {label}
            <HelpTooltip>Used for RSA-SHA1 signing</HelpTooltip>
          </label>
        </td>
        <td className="wide">
          <div className="form-control form-control--underlined form-control--tall no-margin">
            <button className="btn btn--clicky wide" onClick={this._handleEditPrivateKey}>
              <i className="fa fa-edit space-right" />
              {authentication.privateKey ? 'Click to Edit' : 'Click to Add'}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  renderFields() {
    const consumerKey = this.renderInputRow(
      'Consumer Key',
      'consumerKey',
      this._handleChangeConsumerKey,
    );
    const consumerSecret = this.renderInputRow(
      'Consumer Secret',
      'consumerSecret',
      this._handleChangeConsumerSecret,
    );
    const tokenKey = this.renderInputRow('Token', 'tokenKey', this._handleChangeTokenKey);
    const tokenSecret = this.renderInputRow(
      'Token Secret',
      'tokenSecret',
      this._handleChangeTokenSecret,
    );
    const callback = this.renderInputRow('Callback URL', 'callback', this._handleChangeCallback);
    const realm = this.renderInputRow(
      'Realm',
      'realm',
      this._handleChangeRealm,
      'Leave blank for default',
    );
    const nonce = this.renderInputRow(
      'Nonce',
      'nonce',
      this._handleChangeNonce,
      'Leave blank for default',
    );
    const verifier = this.renderInputRow(
      'Verifier',
      'verifier',
      this._handleChangeVerifier,
      'Leave blank for default',
    );
    const timestamp = this.renderInputRow(
      'Timestamp',
      'timestamp',
      this._handleChangeTimestamp,
      'Leave blank for default',
    );
    const signatureMethod = this.renderSelectRow(
      'Signature Method',
      'signatureMethod',
      [
        {
          name: 'HMAC-SHA1',
          value: SIGNATURE_METHOD_HMAC_SHA1,
        },
        {
          name: 'HMAC-SHA256',
          value: SIGNATURE_METHOD_HMAC_SHA256,
        },
        {
          name: 'RSA-SHA1',
          value: SIGNATURE_METHOD_RSA_SHA1,
        },
        {
          name: 'PLAINTEXT',
          value: SIGNATURE_METHOD_PLAINTEXT,
        },
      ],
      this._handleChangeSignatureMethod,
    );
    const privateKey = this.renderPrivateKeyInput(
      'Private Key',
      // @ts-expect-error -- TSCONVERSION
      'privateKey',
      this._handleChangePrivateKey,
    );
    const version = this.renderInputRow('Version', 'version', this._handleChangeVersion);
    const bodyHash = this.renderCheckbox(
      'Hash Body',
      'includeBodyHash',
      'If a application/x-www-form-urlencoded body is present, also generate a ' +
        'oauth_body_hash property',
      this._handleChangeIncludeBodyHash,
    );
    const enabled = this.renderEnabledRow(this._handleChangeEnabled);
    const fields = [
      consumerKey,
      consumerSecret,
      tokenKey,
      tokenSecret,
      signatureMethod,
      callback,
      version,
      timestamp,
      realm,
      nonce,
      verifier,
      bodyHash,
      enabled,
    ];
    const { authentication } = this.props.request;

    if (authentication.signatureMethod === SIGNATURE_METHOD_RSA_SHA1) {
      const i = fields.indexOf(signatureMethod);
      fields.splice(i + 1, 0, privateKey);
    }

    return fields;
  }

  render() {
    const fields = this.renderFields();
    return (
      <div className="pad">
        <table>
          <tbody>{fields}</tbody>
        </table>
      </div>
    );
  }
}
