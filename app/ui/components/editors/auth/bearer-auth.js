import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import * as misc from '../../../../common/misc';

@autobind
class BearerAuth extends PureComponent {
  constructor (props) {
    super(props);

    this._handleChangeProperty = misc.debounce(this._handleChangeProperty, 500);
  }

  _handleChange (token) {
    const {request} = this.props;
    const authentication = Object.assign({}, request.authentication, {token});
    this.props.onChange(authentication);
  }

  render () {
    const {request, handleRender, handleGetRenderContext, nunjucksPowerUserMode} = this.props;
    const {token} = request.authentication;

    return (
      <div className="pad">
        <table>
          <tbody>
          <tr>
            <td className="pad-right no-wrap valign-middle">
              <label htmlFor="bearer-token" className="label--small no-pad">
                Bearer Token
              </label>
            </td>
            <td className="wide">
              <div className="form-control form-control--underlined no-margin">
                <OneLineEditor
                  id="bearer-token"
                  onChange={this._handleChange}
                  defaultValue={token || ''}
                  render={handleRender}
                  nunjucksPowerUserMode={nunjucksPowerUserMode}
                  placeholder="token"
                  getRenderContext={handleGetRenderContext}
                />
              </div>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

BearerAuth.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  nunjucksPowerUserMode: PropTypes.bool.isRequired,
  request: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired
};

export default BearerAuth;
