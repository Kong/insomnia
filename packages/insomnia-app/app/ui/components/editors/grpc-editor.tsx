import React from 'react';
import CodeEditor from '../codemirror/code-editor';
import type { Settings } from '../../../models/settings';
type Props = {
  content: string;
  handleChange: (arg0: string) => Promise<void>;
  settings: Settings;
  readOnly: boolean;
  handleRender?: (arg0: string) => Promise<string>;
  isVariableUncovered?: boolean;
  handleGetRenderContext?: (...args: Array<any>) => any;
};

const GRPCEditor = ({
  content,
  handleChange,
  readOnly,
  settings,
  handleGetRenderContext,
  handleRender,
  isVariableUncovered,
}: Props) => (
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
    render={handleRender}
    getRenderContext={handleGetRenderContext}
    isVariableUncovered={isVariableUncovered}
    nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
  />
);

export default GRPCEditor;
