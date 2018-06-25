// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import OneLineEditor from '../../codemirror/one-line-editor';
import Button from '../../base/button';
import HelpTooltip from '../../help-tooltip';
import type { RequestAuthentication } from '../../../../models/request';

type Props = {
  authentication: RequestAuthentication,
  nunjucksPowerUserMode: boolean,
  showPasswords: boolean,
  onChange: RequestAuthentication => void,
  handleRender: string => Promise<string>,
  handleGetRenderContext: () => Promise<Object>,
  handleUpdateSettingsShowPasswords: boolean => Promise<void>
};

@autobind
class AWSAuth extends React.PureComponent<Props> {
  _handleDisable() {
    const { authentication } = this.props;
    authentication.disabled = !authentication.disabled;
    this.props.onChange(authentication);
  }

  _handleChangeAccessKeyId(value: string) {
    const { authentication } = this.props;
    authentication.accessKeyId = value;
    this.props.onChange(authentication);
  }

  _handleChangeSecretAccessKey(value: string) {
    const { authentication } = this.props;
    authentication.secretAccessKey = value;
    this.props.onChange(authentication);
  }

  _handleChangeRegion(value: string) {
    const { authentication } = this.props;
    authentication.region = value;
    this.props.onChange(authentication);
  }

  _handleChangeService(value: string) {
    const { authentication } = this.props;
    authentication.service = value;
    this.props.onChange(authentication);
  }

  _handleChangeSessionToken(value: string) {
    const { authentication } = this.props;
    authentication.sessionToken = value;
    this.props.onChange(authentication);
  }

  renderRow(key: string, label: string, onChange: Function, help?: string) {
    const {
      authentication,
      nunjucksPowerUserMode,
      handleRender,
      handleGetRenderContext
    } = this.props;

    return (
      <tr key={key}>
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor="sessionToken" className="label--small no-pad">
            {label}
            {help ? <HelpTooltip>{help}</HelpTooltip> : null}
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
              id={key}
              onChange={onChange}
              defaultValue={authentication[key] || ''}
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
    const { authentication } = this.props;
    return (
      <div className="pad">
        <table>
          <tbody>
            {this.renderRow(
              'accessKeyId',
              'Access Key ID',
              this._handleChangeAccessKeyId
            )}
            {this.renderRow(
              'secretAccessKey',
              'Secret Access Key',
              this._handleChangeSecretAccessKey
            )}
            {this.renderRow(
              'region',
              'Region',
              this._handleChangeRegion,
              "will be calculated from hostname or host or use 'us-east-1' if not given"
            )}
            {this.renderRow(
              'service',
              'Service',
              this._handleChangeService,
              'will be calculated from hostname or host if not given'
            )}
            {this.renderRow(
              'sessionToken',
              'Session Token',
              this._handleChangeSessionToken,
              'Optional token used for multi-factor authentication'
            )}
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

export default AWSAuth;
