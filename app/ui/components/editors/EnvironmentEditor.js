import React, {PropTypes, Component} from 'react';
import Editor from '../codemirror/Editor';
import {DEBOUNCE_MILLIS} from '../../../common/constants';

class EnvironmentEditor extends Component {
  _handleChange = () => this.props.didChange();

  _setEditorRef = n => this._editor = n;

  getValue () {
    return JSON.parse(this._editor.getValue());
  }

  isValid () {
    try {
      return this.getValue() !== undefined;
    } catch (e) {
      // Failed to parse JSON
      return false;
    }
  }

  render () {
    const {
      environment,
      editorFontSize,
      editorKeyMap,
      render,
      lineWrapping,
      ...props
    } = this.props;

    return (
      <Editor
        ref={this._setEditorRef}
        fontSize={editorFontSize}
        lineWrapping={lineWrapping}
        keyMap={editorKeyMap}
        onChange={this._handleChange}
        debounceMillis={DEBOUNCE_MILLIS * 6}
        value={JSON.stringify(environment)}
        autoPrettify={true}
        render={render}
        mode="application/json"
        {...props}
      />
    )
  }
}

EnvironmentEditor.propTypes = {
  environment: PropTypes.object.isRequired,
  didChange: PropTypes.func.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorKeyMap: PropTypes.string.isRequired,
  render: PropTypes.func.isRequired,
  lineWrapping: PropTypes.bool.isRequired,
};

export default EnvironmentEditor;
