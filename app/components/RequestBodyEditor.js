import React, {PropTypes} from 'react';
import Editor from './base/Editor';

const RequestBodyEditor = ({body, contentType, onChange, className}) => (
  <Editor
    value={body}
    className={className}
    onChange={onChange}
    mode={contentType}
    lineWrapping={true}
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
