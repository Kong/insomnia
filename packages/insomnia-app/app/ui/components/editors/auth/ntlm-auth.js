// @flow
import * as React from 'react';
import classnames from 'classnames';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import Button from '../../base/button';
import type { Request, RequestAuthentication } from '../../../../models/request';
import type { Settings } from '../../../../models/settings';

type Props = {
  handleRender: Function,
  handleGetRenderContext: Function,
  handleUpdateSettingsShowPasswords: (boolean) => Promise<Settings>,
  nunjucksPowerUserMode: boolean,
  onChange: (Request, RequestAuthentication) => Promise<Request>,
  request: Request,
  showPasswords: boolean,
  isVariableUncovered: boolean,
};

@autobind
class NTLMAuth extends React.PureComponent<Props> {
  _handleDisable() {
    const { request, onChange } = this.props;
    onChange(request, {
      ...request.authentication,
      disabled: !request.authentication.disabled,
    });
  }

  _handleChangeUsername(value: string) {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, username: value });
  }

  _handleChangePassword(value: string) {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, password: value });
  }

  render() {
    const {
      request,
      showPasswords,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
    } = this.props;

    const { authentication } = request;

    return (
      <div className="pad">
        <table>
          <tbody>
          <tr>
            <td className="pad-right no-wrap valign-middle">
              <label htmlFor="username" className="label--small no-pad">
                Username
              </label>
            </td>
            <td className="wide">
              <div
                className={classnames('form-control form-control--underlined no-margin', {
                  'form-control--inactive': authentication.disabled,
                })}>
                <OneLineEditor
                  type="text"
                  id="username"
                  disabled={authentication.disabled}
                  onChange={this._handleChangeUsername}
                  defaultValue={authentication.username || ''}
                  nunjucksPowerUserMode={nunjucksPowerUserMode}
                  render={handleRender}
                  getRenderContext={handleGetRenderContext}
                  isVariableUncovered={isVariableUncovered}
                />
              </div>
            </td>
          </tr>
          <tr>
            <td className="pad-right no-wrap valign-middle">
              <label htmlFor="password" className="label--small no-pad">
                Password
              </label>
            </td>
            <td className="wide">
              <div
                className={classnames('form-control form-control--underlined no-margin', {
                  'form-control--inactive': authentication.disabled,
                })}>
                <OneLineEditor
                  type={showPasswords ? 'text' : 'password'}
                  id="password"
                  onChange={this._handleChangePassword}
                  defaultValue={authentication.password || ''}
                  nunjucksPowerUserMode={nunjucksPowerUserMode}
                  render={handleRender}
                  getRenderContext={handleGetRenderContext}
                  isVariableUncovered={isVariableUncovered}
                />
              </div>
            </td>
          </tr>
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
                  title={authentication.disabled ? 'Enable item' : 'Disable item'}>
                  {authentication.disabled ? (
                    <i className="fa fa-square-o"/>
                  ) : (
                    <i className="fa fa-check-square-o"/>
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

export default NTLMAuth;
