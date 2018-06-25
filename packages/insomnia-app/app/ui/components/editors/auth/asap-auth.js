// @flow
import type { RequestAuthentication } from '../../../../models/request';

import classnames from 'classnames';
import * as React from 'react';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import HelpTooltip from '../../help-tooltip';
import { showModal } from '../../modals';
import CodePromptModal from '../../modals/code-prompt-modal';
import Button from '../../base/button';

type Props = {
  authentication: RequestAuthentication,
  handleRender: Function,
  handleGetRenderContext: Function,
  nunjucksPowerUserMode: boolean,
  onChange: Function
};

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

@autobind
class AsapAuth extends React.PureComponent<Props> {
  _handleDisable() {
    const { authentication } = this.props;
    authentication.disabled = !authentication.disabled;
    this.props.onChange(authentication);
  }

  _handleChangeProperty(property: string, value: string | boolean): void {
    const { authentication } = this.props;
    authentication[property] = value;
    this.props.onChange(authentication);
  }

  _handleChangePrivateKey(value: string): void {
    const { authentication } = this.props;
    authentication.privateKey = value;
    this.props.onChange(authentication);
  }

  renderAsapAuthenticationFields(): React.Node {
    const asapIssuer = this.renderTextInput(
      'Issuer (iss)',
      'issuer',
      'text/plain',
      value => this._handleChangeProperty('issuer', value)
    );

    const asapSubject = this.renderTextInput(
      'Subject (sub)',
      'subject',
      'text/plain',
      value => this._handleChangeProperty('subject', value)
    );

    const asapAudience = this.renderTextInput(
      'Audience (aud)',
      'audience',
      'text/plain',
      value => this._handleChangeProperty('audience', value)
    );

    const asapAdditionalClaims = this.renderTextInput(
      'Additional Claims',
      'additionalClaims',
      'application/json',
      value => this._handleChangeProperty('additionalClaims', value)
    );

    const asapKeyId = this.renderTextInput(
      'Key ID (kid)',
      'keyId',
      'text/plain',
      value => this._handleChangeProperty('keyId', value)
    );

    const asapPrivateKey = this.renderPrivateKeyInput('Private Key');

    return [
      asapIssuer,
      asapSubject,
      asapAudience,
      asapAdditionalClaims,
      asapKeyId,
      asapPrivateKey
    ];
  }

  renderTextInput(
    label: string,
    property: string,
    mode: string,
    onChange: Function
  ): React.Element<*> {
    const {
      handleRender,
      handleGetRenderContext,
      authentication,
      nunjucksPowerUserMode
    } = this.props;
    const id = label.replace(/ /g, '-');
    return (
      <tr key={id}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={id} className="label--small no-pad">
            {label}
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
              mode={mode}
              onChange={onChange}
              defaultValue={authentication[property] || ''}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              render={handleRender}
              getRenderContext={handleGetRenderContext}
            />
          </div>
        </td>
      </tr>
    );
  }

  _handleEditPrivateKey() {
    const { handleRender, handleGetRenderContext, authentication } = this.props;
    showModal(CodePromptModal, {
      submitName: 'Done',
      title: `Edit Private Key`,
      defaultValue: authentication.privateKey,
      onChange: this._handleChangePrivateKey,
      enableRender: handleRender || handleGetRenderContext,
      placeholder: PRIVATE_KEY_PLACEHOLDER,
      mode: 'text/plain',
      hideMode: true
    });
  }

  renderPrivateKeyInput(label: string): React.Element<*> {
    const id = label.replace(/ /g, '-');
    const { authentication } = this.props;
    return (
      <tr key={id}>
        <td className="pad-right pad-top-sm no-wrap valign-top">
          <label htmlFor={id} className="label--small no-pad">
            {label}
            <HelpTooltip>
              Can also use single line data-uri format (e.g. obtained from
              asap-cli export-as-data-uri command), useful for saving as
              environment data
            </HelpTooltip>
          </label>
        </td>
        <td className="wide">
          <div
            className={classnames(
              'form-control form-control--underlined form-control--tall no-margin',
              {
                'form-control--inactive': authentication.disabled
              }
            )}>
            <button
              className="btn btn--clicky wide"
              onClick={this._handleEditPrivateKey}>
              <i className="fa fa-edit space-right" />
              {authentication.privateKey ? 'Click to Edit' : 'Click to Add'}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  render() {
    const fields = this.renderAsapAuthenticationFields();
    const { authentication } = this.props;

    return (
      <div className="pad">
        <table>
          <tbody>
            {fields}
            <tr>
              <td className="pad-right no-wrap valign-middle">
                <label htmlFor="enabled" className="label--small no-pad">
                  Enabled
                </label>
              </td>
              <td className="wide">
                <div className="form-control form-control--underlined">
                  <Button
                    className="btn btn--super-duper-compact"
                    id="enabled"
                    onClick={this._handleDisable}
                    value={!authentication.disabled}
                    title={
                      authentication.disabled ? 'Enable item' : 'Disable item'
                    }>
                    {authentication.disabled ? (
                      <i className="fa fa-square-o" />
                    ) : (
                      <i className="fa fa-check-square-o" />
                    )}
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

export default AsapAuth;
