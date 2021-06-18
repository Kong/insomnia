import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG, JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '../../../common/constants';
import CodeEditor from '../codemirror/code-editor';
import orderedJSON from 'json-order';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../../../templating';
// NeDB field names cannot begin with '$' or contain a period '.'
// Docs: https://github.com/DeNA/nedb#inserting-documents
const INVALID_NEDB_KEY_REGEX = /^\$|\./;
export const ensureKeyIsValid = (key: string): string | null => {
  if (key.match(INVALID_NEDB_KEY_REGEX)) {
    return `"${key}" cannot begin with '$' or contain a '.'`;
  }

  if (key === NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME) {
    return `"${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}" is a reserved key`; // verbiage WIP
  }

  return null;
};

export interface EnvironmentInfo {
  object: Record<string, any>;
  propertyOrder: Record<string, any> | null;
}

interface Props {
  environmentInfo: EnvironmentInfo;
  didChange: (...args: any[]) => any;
  editorFontSize: number;
  editorIndentSize: number;
  editorKeyMap: string;
  render: (...args: any[]) => any;
  getRenderContext: (...args: any[]) => any;
  nunjucksPowerUserMode: boolean;
  isVariableUncovered: boolean;
  lineWrapping: boolean;
}

// There was existing logic to also handle warnings, but it was removed in PR#2601 as there were no more warnings
// to show. If warnings need to be added again, review git history to revert that particular change.
interface State {
  error: string | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class EnvironmentEditor extends PureComponent<Props, State> {
  _editor: CodeEditor | null = null;

  state: State = {
    error: null,
  }

  _handleChange() {
    let error: string | null = null;
    let value: EnvironmentInfo | null = null;

    // Check for JSON parse errors
    try {
      value = this.getValue();
    } catch (err) {
      error = err.message;
    }

    // Check for invalid key names
    // TODO: these only check root properties, not nested properties
    if (value && value.object) {
      for (const key of Object.keys(value.object)) {
        error = ensureKeyIsValid(key);

        if (error) {
          break;
        }
      }
    }

    // Call this last in case component unmounted
    if (this.state.error !== error) {
      this.setState(
        {
          error,
        },
        () => {
          this.props.didChange();
        },
      );
    } else {
      this.props.didChange();
    }
  }

  _setEditorRef(n: CodeEditor) {
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
    const { error } = this.state;
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
          {...props}
        />
        {error && <p className="notice error margin">{error}</p>}
      </div>
    );
  }
}

export default EnvironmentEditor;
