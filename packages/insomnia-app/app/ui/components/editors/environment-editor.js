// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import CodeEditor from '../codemirror/code-editor';
import orderedJSON from 'json-order';
import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '../../../common/constants';
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

// There was existing logic to also handle warnings, but it was removed in PR#2601 as there were no more warnings
// to show. If warnings need to be added again, review git history to revert that particular change.
type State = {
  error: string | null,
};

@autobind
class EnvironmentEditor extends React.PureComponent<Props, State> {
  _editor: CodeEditor | null;

  constructor(props: Props) {
    super(props);
    this.state = {
      error: null,
    };
  }

  _handleChange() {
    let error = null;
    let value = null;

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
      this.setState({ error }, () => {
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
          {...(props: Object)}
        />
        {error && <p className="notice error margin">{error}</p>}
      </div>
    );
  }
}

export default EnvironmentEditor;
