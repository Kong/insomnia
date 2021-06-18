import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import CodeEditor from '../codemirror/code-editor';

interface Props {
  value: string,
  fontSize?: number,
  responseId?: string,
}
@autoBindMethodsForReact(AUTOBIND_CFG)
class ResponseRaw extends PureComponent<Props> {
  private _codeEditor?: CodeEditor;

  _setCodeEditorRef(n: CodeEditor) {
    this._codeEditor = n;
  }

  focus() {
    if (this._codeEditor) {
      this._codeEditor.focus();
    }
  }

  selectAll() {
    if (this._codeEditor) {
      this._codeEditor.selectAll();
    }
  }

  render() {
    const { fontSize, responseId, value } = this.props;
    return (
      <CodeEditor
        ref={this._setCodeEditorRef}
        defaultValue={value}
        fontSize={fontSize}
        hideLineNumbers
        lineWrapping
        mode="text/plain"
        noMatchBrackets
        placeholder="..."
        raw
        readOnly
        uniquenessKey={responseId}
      />
    );
  }
}

export default ResponseRaw;
