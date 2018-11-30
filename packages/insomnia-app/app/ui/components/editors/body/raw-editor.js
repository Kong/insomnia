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
      indentWithTabs,
      nunjucksPowerUserMode,
      isVariableUncovered,
      onChange,
      render,
      uniquenessKey
    } = this.props;

    return (
      <React.Fragment>
        {isVariableUncovered && (
          <CodeEditor
            manualPrettify
            uniquenessKey={uniquenessKey}
            fontSize={fontSize}
            indentSize={indentSize}
            indentWithTabs={indentWithTabs}
            keyMap={keyMap}
            defaultValue={content}
            className={className}
            render={render}
            getRenderContext={getRenderContext}
            nunjucksPowerUserMode={nunjucksPowerUserMode}
            isVariableUncovered={isVariableUncovered}
            onChange={onChange}
            mode={contentType}
            lineWrapping={lineWrapping}
            placeholder="..."
          />
        )}
        {!isVariableUncovered && (
          <CodeEditor
            manualPrettify
            uniquenessKey={uniquenessKey}
            fontSize={fontSize}
            indentSize={indentSize}
            indentWithTabs={indentWithTabs}
            keyMap={keyMap}
            defaultValue={content}
            className={className}
            render={render}
            getRenderContext={getRenderContext}
            nunjucksPowerUserMode={nunjucksPowerUserMode}
            isVariableUncovered={isVariableUncovered}
            onChange={onChange}
            mode={contentType}
            lineWrapping={lineWrapping}
            placeholder="..."
          />
        )}
      </React.Fragment>
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
  isVariableUncovered: PropTypes.bool.isRequired,

  // Optional
  className: PropTypes.string,
  render: PropTypes.func,
  getRenderContext: PropTypes.func,
  indentWithTabs: PropTypes.bool
};

export default RawEditor;
