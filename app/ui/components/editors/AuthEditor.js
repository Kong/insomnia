import React, {PropTypes} from 'react';
import KeyValueEditor from '../base/KeyValueEditor';
import {trackEvent} from '../../../analytics/index';

const AuthEditor = ({authentication, showPasswords, onChange, ...other}) => {
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
      onToggleDisable={pair => trackEvent('Auth Editor', 'Toggle', pair.disabled ? 'Disable' : 'Enable')}
      onCreate={() => trackEvent('Auth Editor', 'Create')}
      onDelete={() => trackEvent('Auth Editor', 'Delete')}
      onChange={pairs => onChange({
        username: pairs.length ? pairs[0].name : '',
        password: pairs.length ? pairs[0].value : '',
        disabled: pairs.length ? pairs[0].disabled : false,
      })}
      {...other}
    />
  );
};

AuthEditor.propTypes = {
  handleUpdateSettingsShowPasswords: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  authentication: PropTypes.object.isRequired,
  showPasswords: PropTypes.bool.isRequired,
};

export default AuthEditor;
