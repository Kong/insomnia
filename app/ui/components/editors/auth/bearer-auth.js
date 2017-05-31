import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import * as misc from '../../../../common/misc';

@autobind
class BearerAuth extends PureComponent {
  constructor (props) {
    super(props);

    this._handleChangeProperty = misc.debounce(this._handleChangeProperty, 500);
  }

  _handleChangeProperty (property, value) {
    const {request} = this.props;
    const authentication = Object.assign({}, request.authentication, {[property]: value});
    this.props.onChange(authentication);
  }

  _handleToken (value) {
    this._handleChangeProperty('token', value);
  }

  renderInputRow (label, property, onChange) {
    const {handleRender, handleGetRenderContext, request} = this.props;
    const id = label.replace(/ /g, '-');
    return (
      <tr key={id}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={id} className="label--small no-pad">{label}</label>
        </td>
        <td className="wide">
          <div className="form-control form-control--underlined no-margin">
            <OneLineEditor
              id={id}
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
    return (
      <div className="pad">
        <table>
          <tbody>
          {this.renderInputRow('Token', 'token', this._handleToken)}
          </tbody>
        </table>
      </div>
    );
  }
}

BearerAuth.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired
};

export default BearerAuth;
