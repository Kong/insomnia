import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { createRef, PureComponent, RefObject } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { CodeEditor,  UnconnectedCodeEditor } from '../codemirror/code-editor';

interface Props {
  value: string;
  responseId?: string;
}
@autoBindMethodsForReact(AUTOBIND_CFG)
export class ResponseRawViewer extends PureComponent<Props> {
  private _editorRef: RefObject<UnconnectedCodeEditor> = createRef();

  focus() {
    this._editorRef.current?.focus();
  }

  selectAll() {
    this._editorRef.current?.selectAll();
  }

  render() {
    const { responseId, value } = this.props;
    return (
      <CodeEditor
        ref={this._editorRef}
        defaultValue={value}
        hideLineNumbers
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
