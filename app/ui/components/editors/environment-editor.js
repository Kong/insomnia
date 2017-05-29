import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import CodeEditor from '../codemirror/code-editor';
import {DEBOUNCE_MILLIS} from '../../../common/constants';

@autobind
class EnvironmentEditor extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      error: null,
      warning: null
    };
  }

  _handleChange () {
    let error = null;
    let warning = null;
    let value = null;

    // Check for JSON parse errors
    try {
      value = this.getValue();
    } catch (err) {
      error = err.message;
    }

    // Check for invalid key names
    if (value) {
      for (const key of Object.keys(value)) {
        if (!key.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*$/)) {
          warning = `"${key}" must only contain letters, numbers, and underscores`;
          break;
        }
      }
    }

    if (this.state.error !== error || this.state.warning !== warning) {
      this.setState({error, warning});
    }

    this.props.didChange();
  }

  _setEditorRef (n) {
    this._editor = n;
  }

  getValue () {
    return JSON.parse(this._editor.getValue());
  }

  isValid () {
    return !this.state.error;
  }

  render () {
    const {
      environment,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      render,
      getRenderContext,
      lineWrapping,
      ...props
    } = this.props;

    const {error, warning} = this.state;

    return (
      <div className="environment-editor">
        <CodeEditor
          ref={this._setEditorRef}
          autoPrettify
          fontSize={editorFontSize}
          indentSize={editorIndentSize}
          lineWrapping={lineWrapping}
          keyMap={editorKeyMap}
          onChange={this._handleChange}
          debounceMillis={DEBOUNCE_MILLIS * 6}
          defaultValue={JSON.stringify(environment)}
          render={render}
          getRenderContext={getRenderContext}
          mode="application/json"
          {...props}
        />
        {error && <p className="notice error margin">{error}</p>}
        {(!error && warning) && <p className="notice warning margin">{warning}</p>}
      </div>
    );
  }
}

EnvironmentEditor.propTypes = {
  environment: PropTypes.object.isRequired,
  didChange: PropTypes.func.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorIndentSize: PropTypes.number.isRequired,
  editorKeyMap: PropTypes.string.isRequired,
  render: PropTypes.func.isRequired,
  getRenderContext: PropTypes.func.isRequired,
  lineWrapping: PropTypes.bool.isRequired
};

export default EnvironmentEditor;
