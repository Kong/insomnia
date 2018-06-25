// @flow
import type { RequestAuthentication } from '../../../../models/request';

import * as React from 'react';
import classnames from 'classnames';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import {
  HAWK_ALGORITHM_SHA1,
  HAWK_ALGORITHM_SHA256
} from '../../../../common/constants';
import HelpTooltip from '../../help-tooltip';
import Button from '../../base/button';

type Props = {
  authentication: RequestAuthentication,
  handleRender: Function,
  handleGetRenderContext: Function,
  nunjucksPowerUserMode: boolean,
  onChange: Function
};

@autobind
class HawkAuth extends React.PureComponent<Props> {
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

  _handleChangeHawkAuthId(value: string): void {
    this._handleChangeProperty('id', value);
  }

  _handleChangeHawkAuthKey(value: string): void {
    this._handleChangeProperty('key', value);
  }

  _handleChangeAlgorithm(e: SyntheticEvent<HTMLSelectElement>): void {
    this._handleChangeProperty('algorithm', e.currentTarget.value);
  }

  renderHawkAuthenticationFields(): React.Node {
    const hawkAuthId = this.renderInputRow(
      'Auth ID',
      'id',
      this._handleChangeHawkAuthId
    );

    const hawkAuthKey = this.renderInputRow(
      'Auth Key',
      'key',
      this._handleChangeHawkAuthKey
    );

    const algorithm = this.renderSelectRow(
      'Algorithm',
      'algorithm',
      [
        { name: HAWK_ALGORITHM_SHA256, value: HAWK_ALGORITHM_SHA256 },
        { name: HAWK_ALGORITHM_SHA1, value: HAWK_ALGORITHM_SHA1 }
      ],
      this._handleChangeAlgorithm
    );

    return [hawkAuthId, hawkAuthKey, algorithm];
  }

  renderSelectRow(
    label: string,
    property: string,
    options: Array<{ name: string, value: string }>,
    onChange: Function,
    help: string | null = null
  ): React.Element<*> {
    const { authentication } = this.props;
    const id = label.replace(/ /g, '-');
    const value = authentication.hasOwnProperty(property)
      ? authentication[property]
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
            className={classnames(
              'form-control form-control--outlined no-margin',
              {
                'form-control--inactive': authentication.disabled
              }
            )}>
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
              type="text"
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

  render() {
    const fields = this.renderHawkAuthenticationFields();
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

export default HawkAuth;
