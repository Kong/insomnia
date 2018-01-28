import {trackEvent} from '../../../../common/analytics';
import autobind from 'autobind-decorator';
import Button from '../../base/button';
import PropTypes from 'prop-types';
import React, {PureComponent} from 'react';

@autobind
class AWSAuth extends PureComponent {
  _handleOnCreate () {
    trackEvent('AWS Auth Editor', 'Create');
  }

  _handleOnDelete () {
    trackEvent('AWS Auth Editor', 'Delete');
  }

  _handleToggleDisable (disabled) {
    const {authentication} = this.props;
    authentication.disabled = disabled;
    this.props.onChange(authentication);
    const label = authentication.disabled ? 'Disable' : 'Enable';
    trackEvent('AWS Auth Editor', 'Toggle', label);
  }

  _handleChange (event) {
    const {authentication} = this.props;
    authentication[event.target.getAttribute('id')] = event.target.value;
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
      <div class="aws-aws-auth__row-wrapper">
      <br/>
      <input
        type='text'
        id='accessKeyId'
        placeholder='AWS_ACCESS_KEY_ID'
        onChange={this._handleChange}
        defaultValue={authentication.accessKeyId || ''}
        nunjucksPowerUserMode={nunjucksPowerUserMode}
        render={handleRender}
        getRenderContext={handleGetRenderContext}
      />
      <br/>
      <input
        type={showPasswords ? 'text' : 'password'}
        id='secretAccessKey'
        placeholder='AWS_SECRET_ACCESS_KEY'
        onChange={this._handleChange}
        defaultValue={authentication.secretAccessKey || ''}
        nunjucksPowerUserMode={nunjucksPowerUserMode}
        render={handleRender}
        getRenderContext={handleGetRenderContext}
      />
      <br/>
      <input
        type={showPasswords ? 'text' : 'password'}
        id='sessionToken'
        placeholder='AWS_SESSION_TOKEN'
        onChange={this._handleChange}
        defaultValue={authentication.sessionToken || ''}
        nunjucksPowerUserMode={nunjucksPowerUserMode}
        render={handleRender}
        getRenderContext={handleGetRenderContext}
      />
      <Button onClick={this._handleToggleDisable}
              value={!authentication.disabled}
              title={authentication.disabled ? 'Enable item' : 'Disable item'}>
        {authentication.disabled
          ? <i className="fa fa-square-o"/>
          : <i className="fa fa-check-square-o"/>
        }
      </Button>
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
