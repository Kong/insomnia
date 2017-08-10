import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import CodeEditor from '../../codemirror/code-editor';

@autobind
class RawEditor extends PureComponent {
  render () {
    const {
      contentType,
      content,
      fontSize,
      indentSize,
      keyMap,
      render,
      getRenderContext,
      lineWrapping,
      onChange,
      className
    } = this.props;

    return (
      <CodeEditor
        manualPrettify
        fontSize={fontSize}
        indentSize={indentSize}
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
  indentSize: PropTypes.number.isRequired,
  keyMap: PropTypes.string.isRequired,
  lineWrapping: PropTypes.bool.isRequired,

  // Optional
  className: PropTypes.string,
  render: PropTypes.func,
  getRenderContext: PropTypes.func
};

export default RawEditor;
