// @flow
import type {Request} from '../../../../models/request';

import * as React from 'react';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import * as misc from '../../../../common/misc';
import HelpTooltip from '../../help-tooltip';
import {SIGNATURE_METHOD_HMAC_SHA1, SIGNATURE_METHOD_PLAINTEXT} from '../../../../network/o-auth-1/constants';

type Props = {
  handleRender: Function,
  handleGetRenderContext: Function,
  nunjucksPowerUserMode: boolean,
  onChange: Function,
  request: Request
};

@autobind
class OAuth1Auth extends React.PureComponent<Props> {
  _handleChangeProperty: Function;

  constructor (props: any) {
    super(props);

    this._handleChangeProperty = misc.debounce(this._handleChangeProperty, 500);
  }

  _handleChangeProperty (property: string, value: string | boolean): void {
    const {request} = this.props;
    const authentication = Object.assign({}, request.authentication, {[property]: value});
    this.props.onChange(authentication);
  }

  _handleChangeConsumerKey (value: string): void {
    this._handleChangeProperty('consumerKey', value);
  }

  _handleChangeConsumerSecret (value: string): void {
    this._handleChangeProperty('consumerSecret', value);
  }

  _handleChangeTokenKey (value: string): void {
    this._handleChangeProperty('tokenKey', value);
  }

  _handleChangeTokenSecret (value: string): void {
    this._handleChangeProperty('tokenSecret', value);
  }

  _handleChangeRealm (value: string): void {
    this._handleChangeProperty('realm', value);
  }

  _handleChangeCallback (value: string): void {
    this._handleChangeProperty('callback', value);
  }

  _handleChangeNonce (value: string): void {
    this._handleChangeProperty('nonce', value);
  }

  _handleChangeTimestamp (value: string): void {
    this._handleChangeProperty('timestamp', value);
  }

  _handleChangeSignatureMethod (e: SyntheticEvent<HTMLInputElement>): void {
    this._handleChangeProperty('signatureMethod', e.currentTarget.value);
  }

  _handleChangeVersion (value: string): void {
    this._handleChangeProperty('version', value);
  }

  renderInputRow (
    label: string,
    property: string,
    onChange: Function,
    help: string | null = null,
    handleAutocomplete: Function | null = null
  ): React.Element<*> {
    const {handleRender, handleGetRenderContext, request, nunjucksPowerUserMode} = this.props;
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
              nunjucksPowerUserMode={nunjucksPowerUserMode}
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

  renderFields (): Array<React.Element<*>> {
    const consumerKey = this.renderInputRow(
      'Consumer Key',
      'consumerKey',
      this._handleChangeConsumerKey
    );

    const consumerSecret = this.renderInputRow(
      'Consumer Secret',
      'consumerSecret',
      this._handleChangeConsumerSecret
    );

    const tokenKey = this.renderInputRow(
      'Token',
      'tokenKey',
      this._handleChangeTokenKey
    );

    const tokenSecret = this.renderInputRow(
      'Token Secret',
      'tokenSecret',
      this._handleChangeTokenSecret
    );

    const callback = this.renderInputRow(
      'Callback URL',
      'callback',
      this._handleChangeCallback
    );

    const realm = this.renderInputRow(
      'Realm',
      'realm',
      this._handleChangeRealm,
      'Leave blank for default'
    );

    const nonce = this.renderInputRow(
      'Nonce',
      'nonce',
      this._handleChangeNonce,
      'Leave blank for default'
    );

    const timestamp = this.renderInputRow(
      'Timestamp',
      'timestamp',
      this._handleChangeTimestamp,
      'Leave blank for default'
    );

    const signatureMethod = this.renderSelectRow(
      'Signature Method',
      'signatureMethod',
      [
        {name: 'HMAC-SHA1', value: SIGNATURE_METHOD_HMAC_SHA1},
        {name: 'PLAINTEXT', value: SIGNATURE_METHOD_PLAINTEXT}
      ],
      this._handleChangeSignatureMethod
    );

    const version = this.renderInputRow(
      'Version',
      'version',
      this._handleChangeVersion
    );

    return [
      consumerKey,
      consumerSecret,
      tokenKey,
      tokenSecret,
      signatureMethod,
      callback,
      version,
      timestamp,
      realm,
      nonce
    ];
  }

  render () {
    const fields = this.renderFields();

    return (
      <div className="pad">
        <table>
          <tbody>
          {fields}
          </tbody>
        </table>
      </div>
    );
  }
}

export default OAuth1Auth;
