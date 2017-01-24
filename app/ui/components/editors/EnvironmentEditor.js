import React, {PropTypes, Component} from 'react';
import Editor from '../base/Editor';

class EnvironmentEditor extends Component {
  _handleChange = () => {
    this.props.didChange();
  };

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
    const {environment, editorFontSize, editorKeyMap, ...props} = this.props;

    return (
      <Editor
        ref={this._setEditorRef}
        fontSize={editorFontSize}
        keyMap={editorKeyMap}
        onChange={this._handleChange}
        value={JSON.stringify(environment)}
        autoPrettify={true}
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
};

export default EnvironmentEditor;
