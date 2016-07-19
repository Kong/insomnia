import React, {PropTypes} from 'react';
import KeyValueEditor from './base/KeyValueEditor';

const RequestAuthEditor = ({request, showPasswords, onChange, ...other}) => {
  const auth = request.authentication;
  const pairs = [{
    name: auth.username || '',
    value: auth.password || ''
  }];

  return (
    <KeyValueEditor
      uniquenessKey={request._id}
      pairs={pairs}
      maxPairs={1}
      namePlaceholder="Username"
      valuePlaceholder="Password"
      valueInputType={showPasswords ? 'text' : 'password'}
      onChange={pairs => onChange({
          username: pairs.length ? pairs[0].name : '',
          password: pairs.length ? pairs[0].value : ''
        })}
      {...other}
    />
  );
};

RequestAuthEditor.propTypes = {
  onChange: PropTypes.func.isRequired,
  request: PropTypes.shape({
    authentication: PropTypes.object.isRequired
  }),
  showPasswords: PropTypes.bool.isRequired
};

export default RequestAuthEditor;
