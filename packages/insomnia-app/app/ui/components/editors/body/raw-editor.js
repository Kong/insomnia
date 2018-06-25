import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import CodeEditor from '../../codemirror/code-editor';

@autobind
class RawEditor extends PureComponent {
  render() {
    const {
      className,
      content,
      contentType,
      fontSize,
      getRenderContext,
      indentSize,
      keyMap,
      lineWrapping,
      nunjucksPowerUserMode,
      onChange,
      render,
      uniquenessKey
    } = this.props;

    return (
      <CodeEditor
        manualPrettify
        uniquenessKey={uniquenessKey}
        fontSize={fontSize}
        indentSize={indentSize}
        keyMap={keyMap}
        defaultValue={content}
        className={className}
        render={render}
        getRenderContext={getRenderContext}
        nunjucksPowerUserMode={nunjucksPowerUserMode}
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
  nunjucksPowerUserMode: PropTypes.bool.isRequired,
  uniquenessKey: PropTypes.string.isRequired,

  // Optional
  className: PropTypes.string,
  render: PropTypes.func,
  getRenderContext: PropTypes.func
};

export default RawEditor;
