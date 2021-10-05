import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../../common/render';
import type { Request, RequestAuthentication } from '../../../../models/request';
import { Button } from '../../base/button';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { HelpTooltip } from '../../help-tooltip';

interface Props {
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  nunjucksPowerUserMode: boolean;
  request: Request;
  onChange: (arg0: Request, arg1: RequestAuthentication) => Promise<Request>;
  isVariableUncovered: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class BearerAuth extends PureComponent<Props> {
  _handleDisable() {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, disabled: !request.authentication.disabled });
  }

  _handleChangeToken(token: string) {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, token });
  }

  _handleChangePrefix(prefix: string) {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, prefix });
  }

  render() {
    const {
      request,
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
                <label htmlFor="token" className="label--small no-pad">
                  Token
                </label>
              </td>
              <td className="wide">
                <div
                  className={classnames('form-control form-control--underlined no-margin', {
                    'form-control--inactive': authentication.disabled,
                  })}
                >
                  <OneLineEditor
                    type="text"
                    id="token"
                    disabled={authentication.disabled}
                    onChange={this._handleChangeToken}
                    defaultValue={authentication.token || ''}
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
                <label htmlFor="prefix" className="label--small no-pad">
                  Prefix{' '}
                  <HelpTooltip>
                    Prefix to use when sending the Authorization header. Defaults to Bearer.
                  </HelpTooltip>
                </label>
              </td>
              <td className="wide">
                <div
                  className={classnames('form-control form-control--underlined no-margin', {
                    'form-control--inactive': authentication.disabled,
                  })}
                >
                  <OneLineEditor
                    type="text"
                    id="prefix"
                    disabled={authentication.disabled}
                    onChange={this._handleChangePrefix}
                    defaultValue={authentication.prefix || ''}
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
          </tbody>
        </table>
      </div>
    );
  }
}
