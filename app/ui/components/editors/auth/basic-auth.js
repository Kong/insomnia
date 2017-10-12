import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../../key-value-editor/editor';
import {trackEvent} from '../../../../analytics/index';
import {AUTH_BASIC} from '../../../../common/constants';

@autobind
class BasicAuth extends PureComponent {
  _handleOnCreate () {
    trackEvent('Basic Auth Editor', 'Create');
  }

  _handleOnDelete () {
    trackEvent('Basic Auth Editor', 'Delete');
  }

  _handleToggleDisable (pair) {
    const label = pair.disabled ? 'Disable' : 'Enable';
    trackEvent('Basic Auth Editor', 'Toggle', label);
  }

  _handleChange (pairs) {
    const pair = {
      type: AUTH_BASIC,
      username: pairs.length ? pairs[0].name : '',
      password: pairs.length ? pairs[0].value : '',
      disabled: pairs.length ? pairs[0].disabled : false
    };

    this.props.onChange(pair);
  }

  render () {
    const {
      authentication,
      showPasswords,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode
    } = this.props;

    const pairs = [{
      name: authentication.username || '',
      value: authentication.password || '',
      disabled: authentication.disabled || false
    }];

    return (
      <KeyValueEditor
        pairs={pairs}
        maxPairs={1}
        disableDelete
        handleRender={handleRender}
        handleGetRenderContext={handleGetRenderContext}
        nunjucksPowerUserMode={nunjucksPowerUserMode}
        namePlaceholder="Username"
        valuePlaceholder="•••••••••••"
        valueInputType={showPasswords ? 'text' : 'password'}
        onToggleDisable={this._handleToggleDisable}
        onCreate={this._handleOnCreate}
        onDelete={this._handleOnDelete}
        onChange={this._handleChange}
      />
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
