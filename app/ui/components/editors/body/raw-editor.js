import React, {PropTypes, PureComponent} from 'react';
import Editor from '../../codemirror/code-editor';

class RawEditor extends PureComponent {
  render () {
    const {
      contentType,
      content,
      fontSize,
      keyMap,
      render,
      getRenderContext,
      lineWrapping,
      onChange,
      className
    } = this.props;

    return (
      <Editor
        manualPrettify
        fontSize={fontSize}
        keyMap={keyMap}
        defaultValue={content}
        className={className}
        render={render}
        getRenderContext={getRenderContext}
        onChange={onChange}
        mode={contentType}
        lineWrapping={lineWrapping}
        placeholder="..."
      />
    );
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
  render: PropTypes.func.isRequired,
  getRenderContext: PropTypes.func.isRequired,

  // Optional
  className: PropTypes.string
};

export default RawEditor;
