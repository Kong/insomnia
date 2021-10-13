import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent } from 'react';

import {
  AUTOBIND_CFG,
  HAWK_ALGORITHM_SHA1,
  HAWK_ALGORITHM_SHA256,
} from '../../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../../common/render';
import type { Request, RequestAuthentication } from '../../../../models/request';
import { Button } from '../../base/button';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { HelpTooltip } from '../../help-tooltip';

interface Props {
  request: Request;
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  nunjucksPowerUserMode: boolean;
  isVariableUncovered: boolean;
  onChange: (arg0: Request, arg1: RequestAuthentication) => Promise<Request>;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class HawkAuth extends PureComponent<Props> {
  _handleDisable() {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, disabled: !request.authentication.disabled });
  }

  _handleChangeProperty(property: string, value: string | boolean) {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, [property]: value });
  }

  _handleChangeHawkAuthId(value: string) {
    this._handleChangeProperty('id', value);
  }

  _handleChangeHawkAuthKey(value: string) {
    this._handleChangeProperty('key', value);
  }

  _handleChangeAlgorithm(e: React.SyntheticEvent<HTMLSelectElement>) {
    this._handleChangeProperty('algorithm', e.currentTarget.value);
  }

  _handleChangeExt(value: string) {
    this._handleChangeProperty('ext', value);
  }

  _handleChangePayloadValidation() {
    const { request } = this.props;

    this._handleChangeProperty('validatePayload', !request.authentication.validatePayload);
  }

  renderHawkAuthenticationFields() {
    const hawkAuthId = this.renderInputRow('Auth ID', 'id', this._handleChangeHawkAuthId);
    const hawkAuthKey = this.renderInputRow('Auth Key', 'key', this._handleChangeHawkAuthKey);
    const algorithm = this.renderSelectRow(
      'Algorithm',
      'algorithm',
      [
        {
          name: HAWK_ALGORITHM_SHA256,
          value: HAWK_ALGORITHM_SHA256,
        },
        {
          name: HAWK_ALGORITHM_SHA1,
          value: HAWK_ALGORITHM_SHA1,
        },
      ],
      this._handleChangeAlgorithm,
    );
    const ext = this.renderInputRow('Ext', 'ext', this._handleChangeExt);
    const payloadValidation = this.renderButtonRow(
      'Validate Payload',
      // @ts-expect-error -- TSCONVERSION
      'validatePayload',
      this._handleChangePayloadValidation,
    );
    return [hawkAuthId, hawkAuthKey, algorithm, ext, payloadValidation];
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
    const { authentication } = this.props.request;
    const id = label.replace(/ /g, '-');
    const value = authentication.hasOwnProperty(property) ? authentication[property] : options[0];
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

  renderInputRow(
    label: string,
    property: string,
    onChange: (...args: any[]) => any,
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
    return (
      <tr key={id}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={id} className="label--small no-pad">
            {label}
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
              type="text"
              onChange={onChange}
              defaultValue={authentication[property] || ''}
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

  renderButtonRow(label: string) {
    const { request } = this.props;
    const { authentication } = request;
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
            className={classnames('form-control form-control--underlined no-margin', {
              'form-control--inactive': authentication.disabled,
            })}
          >
            <Button
              className="btn btn--super-duper-compact"
              id={id}
              onClick={this._handleChangePayloadValidation}
              value={authentication.validatePayload}
              title={
                authentication.validatePayload
                  ? 'Enable payload validation'
                  : 'Disable payload validation'
              }
            >
              {authentication.validatePayload ? (
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

  render() {
    const fields = this.renderHawkAuthenticationFields();
    const { authentication } = this.props.request;
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
