import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../../common/render';
import type { Request, RequestAuthentication } from '../../../../models/request';
import type { Settings } from '../../../../models/settings';
import { Button } from '../../base/button';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { HelpTooltip } from '../../help-tooltip';

interface Props {
  request: Request;
  nunjucksPowerUserMode: boolean;
  showPasswords: boolean;
  isVariableUncovered: boolean;
  onChange: (arg0: Request, arg1: RequestAuthentication) => Promise<Request>;
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  handleUpdateSettingsShowPasswords: (arg0: boolean) => Promise<Settings>;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class AWSAuth extends PureComponent<Props> {
  _handleDisable() {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, disabled: !request.authentication.disabled });
  }

  _handleChangeAccessKeyId(value: string) {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, accessKeyId: value });
  }

  _handleChangeSecretAccessKey(value: string) {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, secretAccessKey: value });
  }

  _handleChangeRegion(value: string) {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, region: value });
  }

  _handleChangeService(value: string) {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, service: value });
  }

  _handleChangeSessionToken(value: string) {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, sessionToken: value });
  }

  renderRow(key: string, label: string, onChange: (...args: any[]) => any, help?: string) {
    const {
      request,
      nunjucksPowerUserMode,
      handleRender,
      handleGetRenderContext,
      isVariableUncovered,
    } = this.props;
    return (
      <tr key={key}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor="sessionToken" className="label--small no-pad">
            {label}
            {help ? <HelpTooltip>{help}</HelpTooltip> : null}
          </label>
        </td>
        <td className="wide">
          <div
            className={classnames('form-control form-control--underlined no-margin', {
              'form-control--inactive': request.authentication.disabled,
            })}
          >
            <OneLineEditor
              id={key}
              onChange={onChange}
              defaultValue={request.authentication[key] || ''}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              render={handleRender}
              getRenderContext={handleGetRenderContext}
              isVariableUncovered={isVariableUncovered}
            />
          </div>
        </td>
      </tr>
    );
  }

  render() {
    const { authentication } = this.props.request;
    return (
      <div className="pad">
        <table>
          <tbody>
            {this.renderRow('accessKeyId', 'Access Key ID', this._handleChangeAccessKeyId)}
            {this.renderRow(
              'secretAccessKey',
              'Secret Access Key',
              this._handleChangeSecretAccessKey,
            )}
            {this.renderRow(
              'region',
              'Region',
              this._handleChangeRegion,
              "will be calculated from hostname or host or use 'us-east-1' if not given",
            )}
            {this.renderRow(
              'service',
              'Service',
              this._handleChangeService,
              'will be calculated from hostname or host if not given',
            )}
            {this.renderRow(
              'sessionToken',
              'Session Token',
              this._handleChangeSessionToken,
              'Optional token used for multi-factor authentication',
            )}
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
