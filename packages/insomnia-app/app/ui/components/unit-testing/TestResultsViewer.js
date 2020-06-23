// @flow
import * as React from 'react';
import CodeEditor from '../codemirror/code-editor';

type Props = {|
  test: string,
  testResults: Object,
  editorLineWrapping: boolean,
  editorFontSize: number,
  editorIndentSize: number,
|};

export default ({ testResults, editorFontSize, editorIndentSize, editorLineWrapping }: Props) => (
  <CodeEditor
    readOnly
    mode="application/json"
    defaultValue={JSON.stringify(testResults, null, 2)}
    fontSize={editorFontSize}
    lineWrapping={editorLineWrapping}
    indentSize={editorIndentSize}
  />
);
