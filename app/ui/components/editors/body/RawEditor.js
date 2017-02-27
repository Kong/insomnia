import React, {PropTypes, Component} from 'react';
import Editor from '../../codemirror/Editor';

class RawEditor extends Component {
  render () {
    const {
      contentType,
      content,
      fontSize,
      keyMap,
      render,
      lineWrapping,
      onChange,
      className
    } = this.props;

    return (
      <Editor
        manualPrettify={true}
        fontSize={fontSize}
        keyMap={keyMap}
        value={content}
        className={className}
        render={render}
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
  fontSize: PropTypes.number.isRequired,
  keyMap: PropTypes.string.isRequired,
  lineWrapping: PropTypes.bool.isRequired,

  // Optional
  render: PropTypes.func,
};

export default RawEditor;
