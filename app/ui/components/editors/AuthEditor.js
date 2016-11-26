import React, {PropTypes, PureComponent} from 'react';
import KeyValueEditor from '../base/KeyValueEditor';
import {trackEvent} from '../../../analytics/index';

class AuthEditor extends PureComponent {
  _handleOnCreate = () => trackEvent('Auth Editor', 'Create');
  _handleOnDelete = () => trackEvent('Auth Editor', 'Delete');

  _handleToggleDisable = pair => {
    const label = pair.disabled ? 'Disable' : 'Enable';
    trackEvent('Auth Editor', 'Toggle', label);
  };

  _handleChange = pairs => {
    const pair = {
      username: pairs.length ? pairs[0].name : '',
      password: pairs.length ? pairs[0].value : '',
      disabled: pairs.length ? pairs[0].disabled : false,
    };

    this.props.onChange(pair);
  };

  render () {
    const {authentication, showPasswords} = this.props;
    const pairs = [{
      name: authentication.username || '',
      value: authentication.password || '',
      disabled: authentication.disabled || false,
    }];

    return (
      <KeyValueEditor
        pairs={pairs}
        maxPairs={1}
        namePlaceholder="Username"
        valuePlaceholder="********"
        valueInputType={showPasswords ? 'text' : 'password'}
        onToggleDisable={this._handleToggleDisable}
        onCreate={this._handleOnCreate}
        onDelete={this._handleOnDelete}
        onChange={this._handleChange}
      />
    );
  }
}

AuthEditor.propTypes = {
  handleUpdateSettingsShowPasswords: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  authentication: PropTypes.object.isRequired,
  showPasswords: PropTypes.bool.isRequired,
};

export default AuthEditor;
