import React, {PropTypes} from 'react';
import Editor from './base/Editor';

const RequestBodyEditor = ({fontSize, lineWrapping, body, contentType, onChange, className}) => (
  <Editor
    fontSize={fontSize}
    value={body}
    className={className}
    onChange={onChange}
    mode={contentType}
    lineWrapping={lineWrapping}
    placeholder="request body here..."
  />
);

RequestBodyEditor.propTypes = {
  // Functions
  onChange: PropTypes.func.isRequired,

  // Other
  body: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired,

  // Optional
  fontSize: PropTypes.number,
  lineWrapping: PropTypes.bool
};

export default RequestBodyEditor;
