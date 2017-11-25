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
      <div className="form-control form-control--underlined pad no-margin">
        <OneLineEditor
          className="no-margin"
          onChange={this._handleChange}
          defaultValue={token || ''}
          render={handleRender}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          placeholder="token"
          getRenderContext={handleGetRenderContext}
        />
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
