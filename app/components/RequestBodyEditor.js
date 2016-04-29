import React, {Component, PropTypes} from 'react';
import Editor from './base/Editor'

const RequestBodyEditor = ({body, contentType, onChange, className}) => (
  <Editor
    value={body}
    className={className}
    debounceMillis={400}
    onChange={onChange}
    mode={contentType}
    placeholder="request body here..."
  />
);

RequestBodyEditor.propTypes = {
  // Functions
  onChange: PropTypes.func.isRequired,

  // Other
  body: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired
};

export default RequestBodyEditor;
