import React, { PureComponent } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import Button from '../../base/button';
import HelpTooltip from '../../help-tooltip';

@autobind
class BearerAuth extends PureComponent {
  _handleDisable() {
    const { authentication } = this.props;
    authentication.disabled = !authentication.disabled;
    this.props.onChange(authentication);
  }

  _handleChangeToken(token) {
    const { authentication } = this.props;
    authentication.token = token;
    this.props.onChange(authentication);
  }

  _handleChangePrefix(prefix) {
    const { authentication } = this.props;
    authentication.prefix = prefix;
    this.props.onChange(authentication);
  }

  render() {
    const {
      authentication,
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
                <label htmlFor="token" className="label--small no-pad">
                  Token
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
                    id="token"
                    disabled={authentication.disabled}
                    onChange={this._handleChangeToken}
                    defaultValue={authentication.token || ''}
                    nunjucksPowerUserMode={nunjucksPowerUserMode}
                    render={handleRender}
                    getRenderContext={handleGetRenderContext}
                  />
                </div>
              </td>
            </tr>
            <tr>
              <td className="pad-right no-wrap valign-middle">
                <label htmlFor="prefix" className="label--small no-pad">
                  Prefix{' '}
                  <HelpTooltip>
                    Prefix to use when sending the Authorization header.
                    Defaults to Bearer.
                  </HelpTooltip>
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
                    id="prefix"
                    disabled={authentication.disabled}
                    onChange={this._handleChangePrefix}
                    defaultValue={authentication.prefix || ''}
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

BearerAuth.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  nunjucksPowerUserMode: PropTypes.bool.isRequired,
  authentication: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired
};

export default BearerAuth;
