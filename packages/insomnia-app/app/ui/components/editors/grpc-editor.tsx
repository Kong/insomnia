import React, { FunctionComponent } from 'react';

import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import type { Settings } from '../../../models/settings';
import { CodeEditor } from '../codemirror/code-editor';

interface Props {
  content?: string;
  handleChange?: (arg0: string) => void;
  settings: Settings;
  readOnly?: boolean;
  handleRender?: HandleRender;
  isVariableUncovered?: boolean;
  handleGetRenderContext?: HandleGetRenderContext;
}

export const GRPCEditor: FunctionComponent<Props> = ({
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
