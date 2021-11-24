import React, { FunctionComponent } from 'react';

import type { Settings } from '../../../models/settings';
import { CodeEditor } from '../codemirror/code-editor';

interface Props {
  content?: string;
  handleChange?: (arg0: string) => void;
  settings: Settings;
  readOnly?: boolean;
  isVariableUncovered?: boolean;
}

export const GRPCEditor: FunctionComponent<Props> = ({
  content,
  handleChange,
  readOnly,
  settings,
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
    isVariableUncovered={isVariableUncovered}
    nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
  />
);
