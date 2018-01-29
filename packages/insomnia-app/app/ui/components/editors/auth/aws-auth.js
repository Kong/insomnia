import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import OneLineEditor from '../../codemirror/one-line-editor';
import Button from '../../base/button';
import PropTypes from 'prop-types';
import HelpTooltip from '../../help-tooltip';

@autobind
class AWSAuth extends PureComponent {
  _handleDisable () {
    const {authentication} = this.props;
    authentication.disabled = !authentication.disabled;
    this.props.onChange(authentication);
  }

  _handleChangeAccessKeyId (value) {
    const {authentication} = this.props;
    authentication.accessKeyId = value;
    this.props.onChange(authentication);
  }

  _handleChangeSecretAccessKey (value) {
    const {authentication} = this.props;
    authentication.secretAccessKey = value;
    this.props.onChange(authentication);
  }

  _handleChangeSessionToken (value) {
    const {authentication} = this.props;
    authentication.sessionToken = value;
    this.props.onChange(authentication);
  }

  render () {
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
              <label htmlFor="accessKeyId" className="label--small no-pad">
                Access Key ID
              </label>
            </td>
            <td className="wide">
              <div className={classnames('form-control form-control--underlined no-margin', {
                'form-control--inactive': authentication.disabled
              })}>
                <OneLineEditor
                  type='text'
                  id='accessKeyId'
                  placeholder='AWS_ACCESS_KEY_ID'
                  onChange={this._handleChangeAccessKeyId}
                  defaultValue={authentication.accessKeyId || ''}
                  nunjucksPowerUserMode={nunjucksPowerUserMode}
                  render={handleRender}
                  getRenderContext={handleGetRenderContext}
                />
              </div>
            </td>
          </tr>
          <tr>
            <td className="pad-right no-wrap valign-middle">
              <label htmlFor="secretAccessKey" className="label--small no-pad">
                Secret Access Key
              </label>
            </td>
            <td className="wide">
              <div className={classnames('form-control form-control--underlined no-margin', {
                'form-control--inactive': authentication.disabled
              })}>
                <OneLineEditor
                  type={showPasswords ? 'text' : 'password'}
                  id='secretAccessKey'
                  placeholder='AWS_SECRET_ACCESS_KEY'
                  onChange={this._handleChangeSecretAccessKey}
                  defaultValue={authentication.secretAccessKey || ''}
                  nunjucksPowerUserMode={nunjucksPowerUserMode}
                  render={handleRender}
                  getRenderContext={handleGetRenderContext}
                />
              </div>
            </td>
          </tr>
          <tr>
            <td className="pad-right no-wrap valign-middle">
              <label htmlFor="sessionToken" className="label--small no-pad">
                Session Token
                <HelpTooltip>Used for multi-factor authentication (optional)</HelpTooltip>
              </label>
            </td>
            <td className="wide">
              <div className={classnames('form-control form-control--underlined no-margin', {
                'form-control--inactive': authentication.disabled
              })}>
                <OneLineEditor
                  id='sessionToken'
                  placeholder='AWS_SESSION_TOKEN'
                  onChange={this._handleChangeSessionToken}
                  defaultValue={authentication.sessionToken || ''}
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
                <Button className="btn btn--super-duper-compact"
                        id="enabled"
                        onClick={this._handleDisable}
                        value={!authentication.disabled}
                        title={authentication.disabled ? 'Enable item' : 'Disable item'}>
                  {authentication.disabled
                    ? <i className="fa fa-square-o"/>
                    : <i className="fa fa-check-square-o"/>
                  }
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

AWSAuth.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  handleUpdateSettingsShowPasswords: PropTypes.func.isRequired,
  nunjucksPowerUserMode: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  authentication: PropTypes.object.isRequired,
  showPasswords: PropTypes.bool.isRequired
};

export default AWSAuth;
