// @flow
import type {Request} from '../../../../models/request';

import * as React from 'react';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import * as misc from '../../../../common/misc';
import {HAWK_ALGORITHM_SHA1, HAWK_ALGORITHM_SHA256} from '../../../../common/constants';
import HelpTooltip from '../../help-tooltip';

type Props = {
  request: Request,
  handleRender: Function,
  handleGetRenderContext: Function,
  nunjucksPowerUserMode: boolean,
  onChange: Function
};

@autobind
class HawkAuth extends React.PureComponent<Props> {
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

  _handleChangeHawkAuthId (value: string): void {
    this._handleChangeProperty('id', value);
  }

  _handleChangeHawkAuthKey (value: string): void {
    this._handleChangeProperty('key', value);
  }

  _handleChangeAlgorithm (e: SyntheticEvent<HTMLSelectElement>): void {
    this._handleChangeProperty('algorithm', e.currentTarget.value);
  }

  renderHawkAuthenticationFields (): React.Node {
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
        {name: HAWK_ALGORITHM_SHA256, value: HAWK_ALGORITHM_SHA256},
        {name: HAWK_ALGORITHM_SHA1, value: HAWK_ALGORITHM_SHA1}
      ],
      this._handleChangeAlgorithm
    );

    return [hawkAuthId, hawkAuthKey, algorithm];
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

  renderInputRow (
    label: string,
    property: string,
    onChange: Function
  ): React.Element<*> {
    const {handleRender, handleGetRenderContext, request, nunjucksPowerUserMode} = this.props;
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
              type="text"
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

  render () {
    const fields = this.renderHawkAuthenticationFields();

    return (
      <div className="pad">
        <table>
          <tbody>{fields}</tbody>
        </table>
      </div>
    );
  }
}

export default HawkAuth;
