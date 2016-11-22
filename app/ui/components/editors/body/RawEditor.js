import React, {PropTypes, Component} from 'react';
import Editor from '../../base/Editor';

class RawEditor extends Component {
  render () {
    const {
      contentType,
      content,
      fontSize,
      lineWrapping,
      onChange,
      className
    } = this.props;

    return (
      <Editor
        manualPrettify={true}
        fontSize={fontSize}
        value={content}
        className={className}
        onChange={onChange}
        mode={contentType}
        lineWrapping={lineWrapping}
        placeholder="..."
      />
    )
  }
}

RawEditor.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  content: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired,

  // Optional
  fontSize: PropTypes.number,
  lineWrapping: PropTypes.bool
};

export default RawEditor;
