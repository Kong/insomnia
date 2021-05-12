import React, { FunctionComponent } from 'react';
import CodeEditor from '../codemirror/code-editor';
import type { Settings } from '../../../models/settings';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';

interface Props {
  content?: string;
  handleChange?: (arg0: string) => void;
  settings: Settings;
  readOnly?: boolean;
  handleRender?: HandleRender;
  isVariableUncovered?: boolean;
  handleGetRenderContext?: HandleGetRenderContext;
}

const GRPCEditor: FunctionComponent<Props> = ({
  content,
  handleChange,
  readOnly,
  settings,
  handleGetRenderContext,
  handleRender,
  isVariableUncovered,
}) => (
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
