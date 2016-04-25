import React, {Component, PropTypes} from 'react';
import Editor from './base/Editor'

class RequestBodyEditor extends Component {
  render () {
    const {body, contentType, requestId, onChange, className} = this.props;

    return (
      <Editor
        value={body}
        className={className}
        debounceMillis={400}
        onChange={onChange}
        uniquenessKey={requestId}
        options={{
          mode: contentType,
          placeholder: 'request body here...'
        }}
      />
    )
  }
}

RequestBodyEditor.propTypes = {
  // Functions
  onChange: PropTypes.func.isRequired,
  
  // Other
  requestId: PropTypes.string.isRequired,
  body: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired
};

export default RequestBodyEditor;
