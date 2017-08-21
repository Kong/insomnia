// @flow
import type { Request } from '../../../../models/request';

import React from 'react';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import * as misc from '../../../../common/misc';

@autobind
class HawkAuth extends React.PureComponent {
  props: {
    request: Request,
    handleRender: Function,
    handleGetRenderContext: Function,
    onChange: Function
  };

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

  _handleChangeAlgorithm (value: string): void {
    this._handleChangeProperty('algorithm', value);
  }

  renderHawkAuthenticationFields (): Array<React.Element<*>> {
    const hawkAuthId = this.renderInputRow(
      'Hawk Auth ID',
      'id',
      this._handleChangeHawkAuthId
    );

    const hawkAuthKey = this.renderInputRow(
      'Hawk Auth Key',
      'key',
      this._handleChangeHawkAuthKey
    );

    const algorithm = this.renderInputRow(
      'Algorithm',
      'algorithm',
      this._handleChangeAlgorithm
    );

    return [hawkAuthId, hawkAuthKey, algorithm];
  }

  renderInputRow (label: string,
                  property: string,
                  onChange: Function): React.Element<*> {
    const {handleRender, handleGetRenderContext, request} = this.props;
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
