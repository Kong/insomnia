import React, {Component, PropTypes} from 'react'
import KeyValueEditor from './base/KeyValueEditor'

class RequestAuthEditor extends Component {
  render () {
    const {request, onChange, ...other} = this.props;

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
        onChange={pairs => onChange({
          username: pairs.length ? pairs[0].name : '',
          password: pairs.length ? pairs[0].value : ''
        })}
        {...other}
      />
    );
  }
}

RequestAuthEditor.propTypes = {
  onChange: PropTypes.func.isRequired,
  request: PropTypes.shape({
    authentication: PropTypes.object.isRequired
  })
};

export default RequestAuthEditor;
