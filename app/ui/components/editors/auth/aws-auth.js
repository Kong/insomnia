import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../../key-value-editor/editor';
import {trackEvent} from '../../../../analytics/index';
import {AUTH_AWS_IAM} from '../../../../common/constants';

@autobind
class AWSAuth extends PureComponent {
  _handleOnCreate () {
    trackEvent('AWS Auth Editor', 'Create');
  }

  _handleOnDelete () {
    trackEvent('AWS Auth Editor', 'Delete');
  }

  _handleToggleDisable (pair) {
    const label = pair.disabled ? 'Disable' : 'Enable';
    trackEvent('AWS Auth Editor', 'Toggle', label);
  }

  _handleChange (pairs) {
    const pair = {
      type: AUTH_AWS_IAM,
      accessKeyId: pairs.length ? pairs[0].name : '',
      secretAccessKey: pairs.length ? pairs[0].value : '',
      disabled: pairs.length ? pairs[0].disabled : false
    };

    this.props.onChange(pair);
  }

  render () {
    const {
      authentication,
      showPasswords,
      handleRender,
      handleGetRenderContext
    } = this.props;

    const pairs = [{
      name: authentication.accessKeyId || '',
      value: authentication.secretAccessKey || '',
      disabled: authentication.disabled || false
    }];

    return (
      <KeyValueEditor
        pairs={pairs}
        maxPairs={1}
        disableDelete
        handleRender={handleRender}
        handleGetRenderContext={handleGetRenderContext}
        namePlaceholder="AWS_ACCESS_KEY_ID"
        valuePlaceholder="AWS_SECRET_ACCESS_KEY"
        valueInputType={showPasswords ? 'text' : 'password'}
        onToggleDisable={this._handleToggleDisable}
        onCreate={this._handleOnCreate}
        onDelete={this._handleOnDelete}
        onChange={this._handleChange}
      />
    );
  }
}

AWSAuth.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  handleUpdateSettingsShowPasswords: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  authentication: PropTypes.object.isRequired,
  showPasswords: PropTypes.bool.isRequired
};

export default AWSAuth;
