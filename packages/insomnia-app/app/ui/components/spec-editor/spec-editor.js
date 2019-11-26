// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import CodeEditor from '../codemirror/code-editor';
import type { Workspace } from '../../../models/workspace';
import type { ApiSpec } from '../../../models/api-spec';
import HelpLink from '../help-link';
import YAML from 'yaml';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

type Props = {|
  apiSpec: ApiSpec,
  workspace: Workspace,
  editorFontSize: number,
  editorIndentSize: number,
  lineWrapping: boolean,
  editorKeyMap: string,
  onChange: (spec: ApiSpec) => Promise<void>,
  handleTest: () => void,
|};

@autobind
class SpecEditor extends React.PureComponent<Props> {
  editor: ?CodeEditor;

  state = {
    previewActive: true,
  };

  _setEditorRef(n: ?CodeEditor) {
    this.editor = n;
  }

  _togglePreview() {
    this.setState({ previewActive: !this.state.previewActive });
  }

  async _handleOnChange(v: string) {
    const { apiSpec, onChange } = this.props;

    await onChange({
      ...apiSpec,
      contents: v,
    });
  }

  setSelection(chStart: number, chEnd: number, lineStart: number, lineEnd: number) {
    const editor = this.editor;

    if (!editor) {
      return;
    }

    editor.setSelection(chStart, chEnd, lineStart, lineEnd);
  }

  render() {
    const {
      editorFontSize,
      editorIndentSize,
      lineWrapping,
      editorKeyMap,
      apiSpec,
      handleTest,
    } = this.props;

    const swaggerSpec = YAML.parse(apiSpec.contents) || {};

    return (
      <div
        className={'spec-editor theme--pane ' + (this.state.previewActive ? '' : 'previewHidden')}>
        <div className="spec-editor__header theme--pane__header">
          <h1>
            Edit API Specification <HelpLink slug="editing-specs" />
          </h1>
          <nav className="spec-editor__header__buttons">
            <button className="btn" onClick={this._togglePreview}>
              <i className={'fa ' + (this.state.previewActive ? 'fa-eye' : 'fa-eye-slash')} />{' '}
              Toggle Preview
            </button>
            <button className="btn" onClick={handleTest}>
              <i className="fa fa-cogs" /> Generate Requests
            </button>
          </nav>
        </div>
        <div id="swagger-ui-wrapper">
          <SwaggerUI spec={swaggerSpec} />
        </div>
        <div className="spec-editor__body theme--pane__body">
          <CodeEditor
            manualPrettify
            ref={this._setEditorRef}
            fontSize={editorFontSize}
            indentSize={editorIndentSize}
            lineWrapping={lineWrapping}
            keyMap={editorKeyMap}
            mode="openapi"
            defaultValue={apiSpec.contents}
            onChange={this._handleOnChange}
            uniquenessKey={apiSpec._id}
          />
        </div>
      </div>
    );
  }
}

export default SpecEditor;
