import React, {Component, PropTypes} from 'react';
import Editor from './base/Editor'

class RequestBodyEditor extends Component {
  shouldComponentUpdate (nextProps) {
    return this.props.request._id !== nextProps.request._id;
  }

  render () {
    const {request, onChange, className} = this.props;
    const mode = request.contentType || 'text/plain';

    return (
      <Editor
        value={request.body}
        className={className}
        onChange={onChange}
        options={{
          mode: mode,
          placeholder: 'request body here...'
        }}
      />
    )
  }
}

RequestBodyEditor.propTypes = {
  request: PropTypes.shape({
    body: PropTypes.string.isRequired
  }).isRequired,
  onChange: PropTypes.func.isRequired
};

export default RequestBodyEditor;
