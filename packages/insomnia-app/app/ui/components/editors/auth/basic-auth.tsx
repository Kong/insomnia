import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import { request } from 'http';
import React, { FC, PureComponent, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { AUTOBIND_CFG } from '../../../../common/constants';
import * as models from '../../../../models';
import { isGrpcRequest } from '../../../../models/grpc-request';
import type { Request, RequestAuthentication, RequestBody } from '../../../../models/request';
import type { Settings } from '../../../../models/settings';
import { selectActiveRequest } from '../../../redux/selectors';
import { Button } from '../../base/button';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { HelpTooltip } from '../../help-tooltip';
import { PasswordEditor } from '../password-editor';

interface Props {
  handleUpdateSettingsShowPasswords: (arg0: boolean) => Promise<Settings>;
  onChange: (arg0: Request, arg1: RequestAuthentication) => Promise<Request>;
  request: Request;
  showPasswords: boolean;
  isVariableUncovered: boolean;
}

const useActiveRequest = () => {
  const activeRequest = useSelector(selectActiveRequest);

  const requestUpdate = useCallback((patch: Partial<Request>) => {
    if (!activeRequest) {
      throw new Error('Tried to update null request');
    }

    if (isGrpcRequest(activeRequest)) {
      throw new Error('Tried to update GrpcRequest, expected Request');
    }

    return models.request.update(activeRequest, patch);
  }, [activeRequest]);

  const updateBody = useCallback((body: Request['body']) => requestUpdate({ body }), [requestUpdate]);
  const updateParameters = useCallback((parameters: Request['parameters']) => requestUpdate({ parameters }), [requestUpdate]);
  const updateAuthentication = useCallback((authentication: Request['authentication']) => requestUpdate({ authentication }), [requestUpdate]);
  const updateHeaders = useCallback((headers: Request['headers']) => requestUpdate({ headers }), [requestUpdate]);
  const updateMethod = useCallback((method: Request['method']) => requestUpdate({ method }), [requestUpdate]);
  const updateUrl = useCallback(async (url: Request['url']) => {
    if (activeRequest?.url === url) {
      return activeRequest;
    }
    return await requestUpdate({ url });
  }, [activeRequest, requestUpdate]);

  return {
    activeRequest,
    updateBody,
    updateAuthentication,
    updateParameters,
    updateHeaders,
    updateMethod,
    updateUrl,
  };
};

export const BasicAuthFC: FC<Props> = ({ request, onChange }) => {
  const handleUseISO88591 = useCallback(() => onChange(request, {
    ...request.authentication,
    useISO88591: !request.authentication.useISO88591,
  }), [onChange, request]);
};

@autoBindMethodsForReact(AUTOBIND_CFG)
export class BasicAuth extends PureComponent<Props> {
  _handleUseISO88591() {
    const { request, onChange } = this.props;
    onChange(request, {
      ...request.authentication,
      useISO88591: !request.authentication.useISO88591,
    });
  }

  _handleDisable() {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, disabled: !request.authentication.disabled });
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
                  })}
                >
                  <OneLineEditor
                    type="text"
                    id="username"
                    disabled={authentication.disabled}
                    onChange={this._handleChangeUsername}
                    defaultValue={authentication.username || ''}
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
              <td className="flex wide">
                <PasswordEditor
                  showAllPasswords={showPasswords}
                  disabled={authentication.disabled}
                  password={authentication.password}
                  onChange={this._handleChangePassword}
                  isVariableUncovered={isVariableUncovered}
                />
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
            <tr>
              <td className="pad-right no-wrap valign-middle">
                <label htmlFor="use-iso-8859-1" className="label--small no-pad">
                  Use ISO 8859-1
                  <HelpTooltip>
                    Check this to use ISO-8859-1 encoding instead of default UTF-8
                  </HelpTooltip>
                </label>
              </td>
              <td className="wide">
                <div className="form-control form-control--underlined">
                  <Button
                    className="btn btn--super-duper-compact"
                    id="use-iso-8859-1"
                    onClick={this._handleUseISO88591}
                    value={authentication.useISO88591}
                    title={authentication.useISO88591 ? 'Enable item' : 'Disable item'}
                  >
                    {authentication.useISO88591 ? (
                      <i className="fa fa-check-square-o" />
                    ) : (
                      <i className="fa fa-square-o" />
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
