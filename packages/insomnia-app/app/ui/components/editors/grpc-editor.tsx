import React, { FunctionComponent } from 'react';

import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import { CodeEditor } from '../codemirror/code-editor';

interface Props {
  content?: string;
  handleChange?: (arg0: string) => void;
  readOnly?: boolean;
  handleRender?: HandleRender;
  isVariableUncovered?: boolean;
  handleGetRenderContext?: HandleGetRenderContext;
}

export const GRPCEditor: FunctionComponent<Props> = ({
  content,
  handleChange,
  readOnly,
  handleGetRenderContext,
  handleRender,
  isVariableUncovered,
}) => (
  <CodeEditor
    defaultValue={content}
    onChange={handleChange}
    mode="application/json"
    readOnly={readOnly}
    autoPrettify={readOnly}
    manualPrettify={!readOnly}
    render={handleRender}
    getRenderContext={handleGetRenderContext}
    isVariableUncovered={isVariableUncovered}
  />
);
