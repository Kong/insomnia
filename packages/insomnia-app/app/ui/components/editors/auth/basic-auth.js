import React, { PureComponent } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import Button from '../../base/button';

@autobind
class BasicAuth extends PureComponent {
  _handleDisable() {
    const { authentication } = this.props;
    authentication.disabled = !authentication.disabled;
    this.props.onChange(authentication);
  }

  _handleChangeUsername(value) {
    const { authentication } = this.props;
    authentication.username = value;
    this.props.onChange(authentication);
  }

  _handleChangePassword(value) {
    const { authentication } = this.props;
    authentication.password = value;
    this.props.onChange(authentication);
  }

  render() {
    const {
      authentication,
      showPasswords,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode
    } = this.props;

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
                  className={classnames(
                    'form-control form-control--underlined no-margin',
                    {
                      'form-control--inactive': authentication.disabled
                    }
                  )}>
                  <OneLineEditor
                    type="text"
                    id="username"
                    disabled={authentication.disabled}
                    onChange={this._handleChangeUsername}
                    defaultValue={authentication.username || ''}
                    nunjucksPowerUserMode={nunjucksPowerUserMode}
                    render={handleRender}
                    getRenderContext={handleGetRenderContext}
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
              <td className="wide">
                <div
                  className={classnames(
                    'form-control form-control--underlined no-margin',
                    {
                      'form-control--inactive': authentication.disabled
                    }
                  )}>
                  <OneLineEditor
                    type={showPasswords ? 'text' : 'password'}
                    id="password"
                    onChange={this._handleChangePassword}
                    defaultValue={authentication.password || ''}
                    nunjucksPowerUserMode={nunjucksPowerUserMode}
                    render={handleRender}
                    getRenderContext={handleGetRenderContext}
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

BasicAuth.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  handleUpdateSettingsShowPasswords: PropTypes.func.isRequired,
  nunjucksPowerUserMode: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  authentication: PropTypes.object.isRequired,
  showPasswords: PropTypes.bool.isRequired
};

export default BasicAuth;
