import { autoBindMethodsForReact } from 'class-autobind-decorator';
import orderedJSON from 'json-order';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG, JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '../../../common/constants';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../../../templating';
import { CodeEditor,  UnconnectedCodeEditor } from '../codemirror/code-editor';

// NeDB field names cannot begin with '$' or contain a period '.'
// Docs: https://github.com/DeNA/nedb#inserting-documents
const INVALID_NEDB_KEY_REGEX = /^\$|\./;

export const ensureKeyIsValid = (key: string, isRoot: boolean): string | null => {
  if (key.match(INVALID_NEDB_KEY_REGEX)) {
    return `"${key}" cannot begin with '$' or contain a '.'`;
  }

  if (key === NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME && isRoot) {
    return `"${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}" is a reserved key`;
  }

  return null;
};

/**
 * Recursively check nested keys in and immediately return when an invalid key found
 */
export function checkNestedKeys(obj: Record<string, any>, isRoot = true): string | null {
  for (const key in obj) {
    let result: string | null = null;

    // Check current key
    result = ensureKeyIsValid(key, isRoot);

    // Exit if necessary
    if (result) {
      return result;
    }

    // Check nested keys
    if (typeof obj[key] === 'object') {
      result = checkNestedKeys(obj[key], false);
    }

    // Exit if necessary
    if (result) {
      return result;
    }
  }

  return null;
}

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
export class EnvironmentEditor extends PureComponent<Props, State> {
  _editor: UnconnectedCodeEditor | null = null;

  state: State = {
    error: null,
  };

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
    if (value && value.object) {
      // Check root and nested properties
      const err = checkNestedKeys(value.object);
      if (err) {
        error = err;
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

  _setEditorRef(n: UnconnectedCodeEditor) {
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
