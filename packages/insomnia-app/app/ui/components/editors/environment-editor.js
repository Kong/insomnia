// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import CodeEditor from '../codemirror/code-editor';

type Props = {
  environment: Object,
  didChange: Function,
  editorFontSize: number,
  editorIndentSize: number,
  editorKeyMap: string,
  render: Function,
  getRenderContext: Function,
  nunjucksPowerUserMode: boolean,
  lineWrapping: boolean
};

type State = {
  error: string | null,
  warning: string | null
};

@autobind
class EnvironmentEditor extends React.PureComponent<Props, State> {
  _editor: CodeEditor | null;

  constructor(props: Props) {
    super(props);
    this.state = {
      error: null,
      warning: null
    };
  }

  _handleChange() {
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

    // Call this last in case component unmounted
    if (this.state.error !== error || this.state.warning !== warning) {
      this.setState({ error, warning }, () => {
        this.props.didChange();
      });
    } else {
      this.props.didChange();
    }
  }

  _setEditorRef(n: ?CodeEditor) {
    this._editor = n;
  }

  getValue() {
    if (this._editor) {
      return JSON.parse(this._editor.getValue());
    } else {
      return '';
    }
  }

  isValid() {
    return !this.state.error;
  }

  render() {
    const {
      environment,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      render,
      getRenderContext,
      nunjucksPowerUserMode,
      lineWrapping,
      ...props
    } = this.props;

    const { error, warning } = this.state;

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
          defaultValue={JSON.stringify(environment)}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          render={render}
          getRenderContext={getRenderContext}
          mode="application/json"
          {...props}
        />
        {error && <p className="notice error margin">{error}</p>}
        {!error &&
          warning && <p className="notice warning margin">{warning}</p>}
      </div>
    );
  }
}

export default EnvironmentEditor;
