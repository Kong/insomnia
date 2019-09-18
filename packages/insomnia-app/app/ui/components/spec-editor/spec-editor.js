// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import CodeEditor from '../codemirror/code-editor';
import type { Workspace } from '../../../models/workspace';
import type { ApiSpec } from '../../../models/api-spec';
import { importRaw } from '../../../common/import';

type Props = {|
  apiSpec: ApiSpec,
  workspace: Workspace,
  editorFontSize: number,
  editorIndentSize: number,
  lineWrapping: boolean,
  editorKeyMap: string,
  onChange: (spec: ApiSpec) => Promise<void>,
|};

@autobind
class SpecEditor extends React.PureComponent<Props> {
  editor: ?CodeEditor;

  _setEditorRef(n: ?CodeEditor) {
    this.editor = n;
  }

  async _handleReImport() {
    const { workspace, apiSpec } = this.props;
    await importRaw(
      () => Promise.resolve(workspace._id), // Always import into current workspace
      apiSpec.contents,
    );
  }

  async _handleOnChange(v: string) {
    const { apiSpec, onChange } = this.props;

    await onChange({
      ...apiSpec,
      contents: v,
    });
  }

  jumpToLine(val: string, value: string | Object) {
    if (this.editor) {
      this.editor.setCursor(0, 0);
    }
    this.editor.search(val, value);
  }

  render() {
    const { editorFontSize, editorIndentSize, lineWrapping, editorKeyMap, apiSpec } = this.props;

    return (
      <div className="spec-editor theme--pane">
        <div className="spec-editor__header theme--pane__header">
          <h1>Edit API Specification</h1>
          <nav className="spec-editor__header__buttons">
            <button className="btn" onClick={this._handleReImport}>
              Re-Import
            </button>
          </nav>
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
