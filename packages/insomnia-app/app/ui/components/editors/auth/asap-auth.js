// @flow
import type {Request} from '../../../../models/request';

import * as React from 'react';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import CodeEditor from '../../codemirror/code-editor';
import HelpTooltip from '../../help-tooltip';

type Props = {
  request: Request,
  handleRender: Function,
  handleGetRenderContext: Function,
  nunjucksPowerUserMode: boolean,
  onChange: Function
};

@autobind
class AsapAuth extends React.PureComponent<Props> {
  _handleChangeProperty (property: string, value: string | boolean): void {
    const {request} = this.props;
    const authentication = Object.assign({}, request.authentication, {[property]: value});
    this.props.onChange(authentication);
  }

  renderAsapAuthenticationFields (): React.Node {
    const asapIssuer = this.renderTextInput(
      'Issuer (iss)',
      'issuer',
      'client-name',
      (value) => this._handleChangeProperty('issuer', value)
    );

    const asapSubject = this.renderTextInput(
      'Subject (sub)',
      'subject',
      'some-username',
      (value) => this._handleChangeProperty('subject', value)
    );

    const asapAudience = this.renderTextInput(
      'Audience (aud)',
      'audience',
      'resource-server-name',
      (value) => this._handleChangeProperty('audience', value)
    );

    const asapKeyId = this.renderTextInput(
      'Key ID (kid)',
      'keyId',
      'key-identifier',
      (value) => this._handleChangeProperty('keyId', value)
    );

    const asapPrivateKey = this.renderPrivateKeyInput(
      'Private Key',
      'privateKey',
      (value) => this._handleChangeProperty('privateKey', value)
    );

    return [asapIssuer, asapSubject, asapAudience, asapKeyId, asapPrivateKey];
  }

  renderTextInput (
    label: string,
    property: string,
    placeholder: string,
    onChange: Function
  ): React.Element<*> {
    const { handleRender, handleGetRenderContext, request, nunjucksPowerUserMode } = this.props;
    const id = label.replace(/ /g, '-');
    return (
      <tr key={id}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={id} className="label--small no-pad">
            {label}
          </label>
        </td>
        <td className="wide">
          <div className="form-control form-control--underlined no-margin">
            <OneLineEditor
              id={id}
              placeholder={placeholder}
              onChange={onChange}
              defaultValue={request.authentication[property] || ''}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              render={handleRender}
              getRenderContext={handleGetRenderContext}
            />
          </div>
        </td>
      </tr>
    );
  }

  renderPrivateKeyInput (
    label: string,
    property: string,
    onChange: Function
  ): React.Element<*> {
    const { handleRender, handleGetRenderContext, request, nunjucksPowerUserMode } = this.props;
    const id = label.replace(/ /g, '-');
    const placeholderPrivateKey = '-----BEGIN RSA PRIVATE KEY-----\n' +
    'MIIEpQIBAAKCAQEA39k9udklHnmkU0GtTLpnYtKk1l5txYmUD/cGI0bFd3HHOOLG\n' +
    'mI0av55vMFEhxL7yrFrcL8pRKp0+pnOVStMDmbwsPE/pu9pf3uxD+m9/Flv89bUk\n' +
    'mml+R3E8PwAYzkX0cr4yQTPN9PSSqy+d2+KrZ9QZmpc3tqltTbMVV93cxKCxfBrf\n' +
    'jbiMIAVh7silDVY5+V46SJu8zY2kXOBBtlrE7/JoMiTURCkRjNIA8/sgSmRxBTdM\n' +
    '313lKJM7NgxaGnREbP75U7ErfBvReJsf5p6h5+XXFirG7F2ntcqjUoR3M+opngp0\n' +
    'CgffdGcsK7MmUUgAG7r05b0mljhI35t/0Y57MwIDAQABAoIBAQCH1rLohudJmROp\n' +
    'Gl/qAewfQiiZlfATQavCDGuDGL1YAIme8a8GgApNYf2jWnidhiqJgRHBRor+yzFr\n' +
    'cJV+wRTs/Szp6LXAgMmTkKMJ+9XXErUIUgwbl27Y3Rv/9ox1p5VRg+A=\n' +
    '-----END RSA PRIVATE KEY-----';
    return (
      <tr key={id}>
        <td className="pad-right pad-top-sm no-wrap valign-top">
          <label htmlFor={id} className="label--small no-pad">
            {label}
            <HelpTooltip>Can also use single line data-uri format (e.g. obtained from asap-cli export-as-data-uri command), useful for saving as environment data</HelpTooltip>
          </label>
        </td>
        <td className="wide">
          <div className="form-control form-control--underlined form-control--tall no-margin">
            <CodeEditor
              id={id}
              onChange={onChange}
              defaultValue={request.authentication[property] || ''}
              dynamicHeight={true}
              hideLineNumbers={true}
              lineWrapping={true}
              placeholder={placeholderPrivateKey}
              style={{height: 200}}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              render={handleRender}
              getRenderContext={handleGetRenderContext}
            />
          </div>
        </td>
      </tr>
    );
  }

  render () {
    const fields = this.renderAsapAuthenticationFields();

    return (
      <div className="pad">
        <table>
          <tbody>{fields}</tbody>
        </table>
      </div>
    );
  }
}

export default AsapAuth;
