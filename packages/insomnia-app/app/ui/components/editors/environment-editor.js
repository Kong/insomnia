// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import CodeEditor from '../codemirror/code-editor';
import orderedJSON from 'json-order';
import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '../../../common/constants';

export type EnvironmentInfo = {
  object: Object,
  propertyOrder: Object | null,
};

type Props = {
  environmentInfo: EnvironmentInfo,
  didChange: Function,
  editorFontSize: number,
  editorIndentSize: number,
  editorKeyMap: string,
  render: Function,
  getRenderContext: Function,
  nunjucksPowerUserMode: boolean,
  isVariableUncovered: boolean,
  lineWrapping: boolean,
};

type State = {
  error: string | null,
  warning: string | null,
};

@autobind
class EnvironmentEditor extends React.PureComponent<Props, State> {
  _editor: CodeEditor | null;

  constructor(props: Props) {
    super(props);
    this.state = {
      error: null,
      warning: null,
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
    if (value && value.object) {
      for (const key of Object.keys(value.object)) {
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

  getValue(): EnvironmentInfo | null {
    if (this._editor) {
      const data = orderedJSON.parse(
        this._editor.getValue(),
        JSON_ORDER_PREFIX,
        JSON_ORDER_SEPARATOR,
      );

      return {
        object: data.object,
        propertyOrder: data.map || null,
      };
    } else {
      return null;
    }
  }

  isValid() {
    return !this.state.error;
  }

  render() {
    const {
      environmentInfo,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      render,
      getRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
      lineWrapping,
      ...props
    } = this.props;

    const { error, warning } = this.state;

    const defaultValue = orderedJSON.stringify(
      environmentInfo.object,
      environmentInfo.propertyOrder || null,
      JSON_ORDER_SEPARATOR,
    );

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
          defaultValue={defaultValue}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          isVariableUncovered={isVariableUncovered}
          render={render}
          getRenderContext={getRenderContext}
          mode="application/json"
          {...(props: Object)}
        />
        {error && <p className="notice error margin">{error}</p>}
        {!error && warning && <p className="notice warning margin">{warning}</p>}
      </div>
    );
  }
}

export default EnvironmentEditor;
