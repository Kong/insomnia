// @flow
import React from 'react';
import CodeEditor from '../codemirror/code-editor';
import type { Settings } from '../../../models/settings';

type Props = {
  content: string,
  handleChange: string => Promise<void>,
  settings: Settings,
  readOnly: boolean,
};

const GRPCEditor = ({ content, handleChange, readOnly, settings, uniquenessKey }: Props) => (
  <CodeEditor
    fontSize={settings.editorFontSize}
    indentSize={settings.editorIndentSize}
    indentWithTabs={settings.editorIndentWithTabs}
    keyMap={settings.editorKeyMap}
    lineWrapping={settings.editorLineWrapping}
    defaultValue={content}
    onChange={handleChange}
    mode="application/json"
    readOnly={readOnly}
    autoPrettify={readOnly}
    manualPrettify={!readOnly}
  />
);

export default GRPCEditor;
